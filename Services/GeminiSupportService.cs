using System.Net.Http.Json;
using System.Text.Json;
using BidNet.Data;
using BidNet.DTOs;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

/// <summary>
/// Dịch vụ gọi Google Gemini API thật kết hợp ngữ cảnh trực tiếp từ SQL Server (Sản phẩm, Đơn hàng, Trang đang xem).
/// Tự động fallback sang SupportAiEngine nội bộ nếu chưa cấu hình Gemini:ApiKey hoặc API gặp sự cố.
/// </summary>
public class GeminiSupportService(
    IConfiguration config,
    IHttpClientFactory httpClientFactory,
    AppDbContext db,
    CurrentUser currentUser,
    ILogger<GeminiSupportService> logger)
{
    private const string SystemInstruction = """
        Bạn là **Auctora AI** – trợ lý hỗ trợ khách hàng thông minh của sàn đấu giá trực tuyến **Auctora**.
        Quy tắc bắt buộc:
        1. Trả lời tự nhiên, lịch sự, chính xác và ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu người dùng hỏi bằng tiếng Anh). Dùng Markdown nhẹ (**in đậm**, gạch đầu dòng •).
        2. Kiến thức nghiệp vụ chính thức của Auctora:
           - Tham gia đấu giá: Cần đăng nhập tài khoản thành viên (Admin không được đặt giá hoặc đăng bán). Giá đặt mới phải >= Giá hiện tại + Bước giá (mặc định 1.000 ₫ hoặc theo từng sản phẩm) và là bội số hợp lệ. Người bán không thể tự đặt giá cho sản phẩm của mình.
           - Đăng bán sản phẩm: Quy trình 4 bước (Thông tin cơ bản → Hình ảnh → Giá & Thời gian → Xác nhận). Sản phẩm ở trạng thái Sắp diễn ra (Scheduled) hoặc Đang diễn ra (Active) chưa có lượt đặt có thể hủy kèm lý do; đã có lượt đặt phải liên hệ Admin.
           - Đơn hàng & Thanh toán: Khi phiên kết thúc có người thắng, đơn hàng tự động được tạo tại mục Đơn hàng (#/orders). Người mua cập nhật địa chỉ nhận hàng và thanh toán demo (BANK_TRANSFER_DEMO hoặc MOMO_DEMO – mô phỏng đồ án, không phát sinh giao dịch tiền thật). Sau khi thanh toán, người bán xác nhận giao hàng.
           - Tài khoản & Bảo mật: Tuyệt đối KHÔNG yêu cầu người dùng cung cấp mật khẩu, mã OTP hay thông tin nhạy cảm.
        3. Không tự bịa đặt giá cả, trạng thái sản phẩm/đơn hàng hoặc phán quyết tranh chấp. Chỉ sử dụng dữ liệu ngữ cảnh được cung cấp bên dưới.
        4. Nếu vấn đề cần Admin/nhân viên can thiệp (khiếu nại, mở khóa tài khoản, hủy phiên đã có người đặt giá), hướng dẫn người dùng bấm nút **Gặp nhân viên →**.
        """;

    public async Task<AiSuggestResponse> SuggestAsync(AiSuggestDto dto, CancellationToken ct)
    {
        // Tin nhắn rỗng (vừa mở chat): trả về lời chào theo ngữ cảnh trang tức thì.
        if (string.IsNullOrWhiteSpace(dto.Message))
            return SupportAiEngine.Respond(dto);

        var apiKey = config["Gemini:ApiKey"]?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("Gemini:ApiKey chưa được cấu hình. Đang dùng SupportAiEngine nội bộ.");
            return SupportAiEngine.Respond(dto);
        }

        var contextText = await BuildContextSummaryAsync(dto, ct);
        var configuredModel = config["Gemini:Model"]?.Trim();
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(configuredModel))
            candidates.Add(configuredModel);
        foreach (var fallback in new[] { "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash" })
        {
            if (!candidates.Contains(fallback, StringComparer.OrdinalIgnoreCase))
                candidates.Add(fallback);
        }

        string? answer = null;
        foreach (var model in candidates)
        {
            answer = await CallGeminiAsync(apiKey, model, dto, contextText, ct);
            if (!string.IsNullOrWhiteSpace(answer))
                break;
        }

        if (string.IsNullOrWhiteSpace(answer))
            return SupportAiEngine.Respond(dto);

        var baseline = SupportAiEngine.Respond(dto);
        return new AiSuggestResponse(
            Answer: answer.Trim(),
            Source: InferSourceLink(dto.PageContext, answer),
            QuickReplies: baseline.QuickReplies,
            Confidence: 0.98,
            CanEscalate: true
        );
    }

    private async Task<string?> CallGeminiAsync(
        string apiKey,
        string model,
        AiSuggestDto dto,
        string contextText,
        CancellationToken ct)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);

            var contents = new List<object>();
            if (dto.History is { Count: > 0 })
            {
                foreach (var turn in dto.History.TakeLast(6))
                {
                    if (string.IsNullOrWhiteSpace(turn.Text)) continue;
                    var role = turn.Role.Equals("ai", StringComparison.OrdinalIgnoreCase) ||
                               turn.Role.Equals("model", StringComparison.OrdinalIgnoreCase)
                        ? "model"
                        : "user";
                    contents.Add(new { role, parts = new[] { new { text = turn.Text } } });
                }
            }

            var userPrompt = string.IsNullOrWhiteSpace(contextText)
                ? dto.Message!
                : $"[Ngữ cảnh hệ thống hiện tại]\n{contextText}\n\n[Câu hỏi của người dùng]\n{dto.Message}";

            contents.Add(new { role = "user", parts = new[] { new { text = userPrompt } } });

            var payload = new
            {
                system_instruction = new { parts = new[] { new { text = SystemInstruction } } },
                contents,
                generationConfig = new
                {
                    temperature = 0.4,
                    maxOutputTokens = 700
                }
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}";
            using var resp = await client.PostAsJsonAsync(url, payload, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var errBody = await resp.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Gemini API ({Model}) trả về mã {Status}: {Body}", model, (int)resp.StatusCode, errBody);
                return null;
            }

            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
            {
                var parts = candidates[0].GetProperty("content").GetProperty("parts");
                if (parts.GetArrayLength() > 0 && parts[0].TryGetProperty("text", out var textEl))
                    return textEl.GetString();
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi khi gọi Gemini API ({Model})", model);
        }
        return null;
    }

    private async Task<string> BuildContextSummaryAsync(AiSuggestDto dto, CancellationToken ct)
    {
        var lines = new List<string>();
        if (!string.IsNullOrWhiteSpace(dto.PageContext))
            lines.Add($"- Trang đang xem: {dto.PageContext}");

        if (dto.ProductId is > 0)
        {
            var product = await db.Products.AsNoTracking()
                .Where(p => p.Id == dto.ProductId.Value)
                .Select(p => new
                {
                    p.Id, p.Name, p.Status, p.StartingPrice, p.CurrentPrice, p.StartTime, p.EndTime,
                    BidCount = p.Bids.Count
                })
                .FirstOrDefaultAsync(ct);

            if (product != null)
            {
                lines.Add($"- Sản phẩm #{product.Id}: \"{product.Name}\" | Trạng thái: {product.Status} | Giá khởi điểm: {product.StartingPrice:N0} ₫ | Giá hiện tại: {product.CurrentPrice:N0} ₫ | Số lượt đặt: {product.BidCount} | Bắt đầu: {product.StartTime:u} | Kết thúc: {product.EndTime:u}");
            }
        }

        // Chỉ truy vấn đơn hàng nếu người dùng đã đăng nhập và là người mua/người bán của đơn đó.
        var user = await currentUser.OptionalAsync(ct);
        if (user != null)
        {
            lines.Add($"- Người dùng đang đăng nhập: {user.Username} (Vai trò: {user.Role})");
            if (dto.OrderId is > 0)
            {
                var order = await db.Orders.AsNoTracking()
                    .Where(o => o.Id == dto.OrderId.Value && (o.BuyerId == user.Id || o.SellerId == user.Id || user.Role == "Admin"))
                    .Select(o => new
                    {
                        o.Id, o.Status, o.FinalPrice, o.PaymentStatus, o.PaymentMethod,
                        HasAddress = !string.IsNullOrWhiteSpace(o.ShippingAddress)
                    })
                    .FirstOrDefaultAsync(ct);

                if (order != null)
                {
                    lines.Add($"- Đơn hàng #{order.Id}: Trạng thái {order.Status} | Giá chốt: {order.FinalPrice:N0} ₫ | Thanh toán: {order.PaymentStatus} ({order.PaymentMethod ?? "Chưa chọn"}) | Địa chỉ nhận hàng: {(order.HasAddress ? "Đã cập nhật" : "Chưa cập nhật")}");
                }
            }
        }
        else
        {
            lines.Add("- Người dùng hiện chưa đăng nhập.");
        }

        return string.Join("\n", lines);
    }

    private static string? InferSourceLink(string? pageContext, string answer)
    {
        var lower = answer.ToLowerInvariant();
        if (lower.Contains("đơn hàng") || pageContext == "orders") return "#/orders";
        if (lower.Contains("đăng bán") || pageContext == "my-products") return "#/my-products";
        if (lower.Contains("hướng dẫn") || lower.Contains("quy tắc")) return "#/guides";
        if (lower.Contains("chính sách") || lower.Contains("bảo mật")) return "#/policies";
        return null;
    }
}
