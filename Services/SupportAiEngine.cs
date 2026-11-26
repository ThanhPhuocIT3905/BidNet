using BidNet.DTOs;

namespace BidNet.Services;

/// <summary>
/// Engine AI hỗ trợ nội bộ BidNet – không dùng API key thật.
/// Sử dụng quy tắc từ khóa + ngữ cảnh trang để trả lời các câu hỏi phổ biến
/// về đấu giá, tài khoản, đơn hàng và hướng dẫn sử dụng BidNet.
/// 
/// Kiến trúc: Keyword matching + Context-aware FAQ lookup.
/// Mở rộng lên LLM thật: thay method Respond() bằng gọi OpenAI/Gemini API.
/// </summary>
public static class SupportAiEngine
{
    private record FaqEntry(string[] Keywords, string Answer, string? Source = null, string[]? QuickReplies = null);

    private static readonly FaqEntry[] KnowledgeBase =
    [
        new(["chào", "xin chào", "hello", "hi", "hey", "alo"],
            "Chào bạn! Tôi là **BidNet AI** – trợ lý hỗ trợ của sàn đấu giá BidNet.\n\nTôi có thể giúp bạn giải đáp về:\n• Cách tham gia đấu giá & bước giá\n• Đăng bán & quản lý sản phẩm\n• Đơn hàng, giao nhận & thanh toán demo\n• Tài khoản & bảo mật\n\nBạn đang cần hỗ trợ vấn đề gì hôm nay?",
            null, ["BidNet hoạt động thế nào?", "Tham gia đấu giá thế nào?", "Gặp nhân viên hỗ trợ"]),
        new(["đấu giá", "cách", "tham gia", "hướng dẫn"],
            "Để tham gia đấu giá trên BidNet:\n1. Đăng nhập tài khoản\n2. Vào trang sản phẩm bạn quan tâm\n3. Nhập giá đặt cao hơn giá hiện tại\n4. Bấm **Đặt giá**\n\nHệ thống sẽ thông báo nếu có người trả giá cao hơn bạn.",
            "#/guides", ["Bước giá là gì?", "Khi nào phiên kết thúc?"]),
        new(["bước giá", "increment", "mức giá", "tăng bao nhiêu"],
            "**Bước giá** là mức tăng tối thiểu mỗi lần đặt giá.\n- Nếu giá hiện tại là 1.000.000 ₫ và bước giá là 50.000 ₫, bạn cần đặt tối thiểu 1.050.000 ₫.\n- Giá trị bước giá hiển thị ngay dưới khung đặt giá trên trang sản phẩm.",
            null, ["Làm sao để đặt giá?", "Tôi không đặt được giá"]),
        new(["không đặt", "lỗi đặt giá", "không thể đặt", "đặt giá thất bại"],
            "Có một số lý do khiến bạn không thể đặt giá:\n• **Giá quá thấp** – Phải cao hơn giá tối thiểu hiện tại\n• **Sai bước giá** – Giá phải tăng đúng bội số bước giá\n• **Phiên đã đóng** – Thời gian đấu giá đã hết\n• **Chính chủ sản phẩm** – Người bán không được tự đặt giá\n• **Chưa đăng nhập** – Cần tài khoản để tham gia",
            null, ["Liên hệ nhân viên hỗ trợ"]),
        new(["đăng ký", "tạo tài khoản", "đăng nhập", "quên mật khẩu"],
            "Để **đăng ký** tài khoản BidNet:\n1. Bấm **Đăng ký** góc trên phải\n2. Điền Tên đăng nhập, Email và Mật khẩu\n3. Nhấn **Tạo tài khoản**\n\nNếu **quên mật khẩu**, liên hệ hỗ trợ qua mục này để được Admin đặt lại.",
            null, ["Thay đổi thông tin tài khoản", "Bảo mật tài khoản"]),
        new(["đăng bán", "đăng sản phẩm", "bán", "seller"],
            "Để **đăng sản phẩm đấu giá**:\n1. Vào **Đăng bán** trên menu\n2. Điền thông tin sản phẩm (4 bước)\n3. Đặt giá khởi điểm và thời gian\n4. Bấm **Đăng bán**\n\nSản phẩm sẽ chờ Admin duyệt trước khi hiển thị công khai.",
            "#/my-products", ["Sản phẩm chưa được duyệt", "Hủy phiên đấu giá"]),
        new(["chưa duyệt", "pending", "đang duyệt", "admin từ chối"],
            "Sản phẩm cần **Admin duyệt** trước khi mở phiên đấu giá.\n- **Đang chờ duyệt**: Admin chưa xem xét\n- **Đã từ chối**: Xem lý do tại trang Sản phẩm của tôi, chỉnh sửa và đăng lại\n- Thời gian duyệt thông thường trong vòng 24 giờ",
            "#/my-products", ["Liên hệ nhân viên hỗ trợ"]),
        new(["đơn hàng", "mua", "thắng", "thanh toán"],
            "Sau khi **thắng đấu giá**, đơn hàng được tạo tự động.\n1. Vào **Đơn hàng** trên tài khoản\n2. Cập nhật địa chỉ giao hàng\n3. Thanh toán demo (BANK_TRANSFER_DEMO hoặc MOMO_DEMO)\n4. Chờ người bán xác nhận giao hàng",
            "#/orders", ["Trạng thái đơn hàng", "Liên hệ người bán"]),
        new(["vận chuyển", "giao hàng", "shipping", "địa chỉ"],
            "Để cập nhật **địa chỉ giao hàng**:\n1. Vào **Đơn hàng** → chọn đơn\n2. Bấm **Cập nhật địa chỉ**\n3. Điền đầy đủ thông tin người nhận và địa chỉ\n\nNgười bán sẽ giao hàng theo địa chỉ bạn cung cấp.",
            "#/orders"),
        new(["hủy", "cancel", "hoàn tiền", "refund"],
            "Chính sách **hủy và hoàn tiền** BidNet:\n- Phiên **Chưa bắt đầu**: Người bán có thể hủy\n- Phiên **Đang diễn ra + chưa có lượt đặt**: Người bán có thể hủy kèm lý do\n- Phiên **Có người đặt giá**: Liên hệ Admin để xử lý\n- Đơn hàng: Người bán/Admin có thể hủy kèm lý do",
            "#/policies"),
        new(["bảo mật", "mật khẩu", "tài khoản bị khóa", "hack"],
            "Để **bảo vệ tài khoản** BidNet:\n• Không chia sẻ mật khẩu hoặc OTP\n• Đăng xuất khi dùng thiết bị công cộng\n• Liên hệ ngay nếu nghi tài khoản bị xâm phạm\n\nTài khoản bị khóa do vi phạm chính sách – liên hệ Admin để khiếu nại.",
            "#/policies/chinh-sach-bao-mat"),
        new(["phí", "chi phí", "hoa hồng", "bao nhiêu tiền"],
            "BidNet (đồ án) hiện **không thu phí** hoa hồng hay phí đăng bán.\nThanh toán là mô phỏng demo (BANK_TRANSFER_DEMO, MOMO_DEMO) – không phát sinh giao dịch tiền thật.",
            "#/policies"),
        new(["liên hệ", "nhân viên", "hỗ trợ", "gặp người thật", "gặp nhân viên"],
            "Bạn có thể **gửi yêu cầu hỗ trợ** cho đội ngũ BidNet:\n1. Điền thông tin vào form bên dưới (hoặc tại trang Liên hệ)\n2. Admin sẽ phản hồi qua hệ thống ticket\n3. Theo dõi tiến trình tại mục **Yêu cầu hỗ trợ** trong tài khoản",
            "#/contact", ["Tạo yêu cầu hỗ trợ"]),
    ];

    // Câu hỏi gợi ý theo ngữ cảnh trang
    private static readonly Dictionary<string, string[]> ContextQuickReplies = new()
    {
        ["home"]          = ["BidNet hoạt động thế nào?", "Làm sao để tham gia đấu giá?", "Làm sao để đăng bán?"],
        ["product"]       = ["Bước giá là gì?", "Tôi không đặt được giá", "Phiên kết thúc khi nào?"],
        ["auctions"]      = ["Lọc sản phẩm thế nào?", "Tại sao tôi không thấy sản phẩm?", "Tham gia đấu giá thế nào?"],
        ["my-products"]   = ["Sản phẩm chưa được duyệt?", "Làm sao hủy phiên?", "Đăng lại sản phẩm?"],
        ["orders"]        = ["Đơn hàng đang ở trạng thái nào?", "Cập nhật địa chỉ giao hàng", "Hủy đơn hàng"],
        ["my-bids"]       = ["Tôi có đang dẫn đầu không?", "Phiên đấu giá kết thúc khi nào?", "Xem lịch sử đặt giá"],
        ["profile"]       = ["Đổi mật khẩu thế nào?", "Cập nhật thông tin cá nhân", "Bảo mật tài khoản"],
        ["contact"]       = ["Gửi yêu cầu hỗ trợ", "Thời gian phản hồi bao lâu?", "Khiếu nại sản phẩm"],
        ["guides"]        = ["Quy tắc đấu giá", "Hướng dẫn thanh toán", "Chính sách giao hàng"],
        [""]              = ["BidNet hoạt động thế nào?", "Tham gia đấu giá", "Liên hệ hỗ trợ"],
    };

    public static AiSuggestResponse Respond(AiSuggestDto dto)
    {
        var msg = dto.Message?.ToLowerInvariant().Trim() ?? "";
        // Khớp câu hỏi với knowledge base
        var match = FindBestMatch(msg);
        var context = dto.PageContext?.ToLowerInvariant().Trim() ?? "";
        var contextKey = ContextQuickReplies.Keys.FirstOrDefault(k => !string.IsNullOrEmpty(k) && context.Contains(k)) ?? "";
        var quickReplies = match?.QuickReplies ?? ContextQuickReplies.GetValueOrDefault(contextKey) ?? ContextQuickReplies[""];
        if (string.IsNullOrWhiteSpace(msg))
        {
            return new AiSuggestResponse(
                Answer: BuildWelcome(context),
                Source: null,
                QuickReplies: ContextQuickReplies.GetValueOrDefault(contextKey) ?? ContextQuickReplies[""],
                Confidence: 1.0,
                CanEscalate: true
            );
        }
        if (match != null)
        {
            return new AiSuggestResponse(
                Answer: match.Answer,
                Source: match.Source,
                QuickReplies: quickReplies,
                Confidence: 0.9,
                CanEscalate: true
            );
        }
        // Fallback: hỏi lại hoặc đề xuất liên hệ nhân viên
        return new AiSuggestResponse(
            Answer: "Xin lỗi, tôi chưa có thông tin chính xác để trả lời câu hỏi này.\n\nBạn có thể thử:\n• Mô tả chi tiết hơn vấn đề đang gặp\n• Xem **Hướng dẫn & Quy định** tại menu\n• Gửi yêu cầu để nhân viên hỗ trợ trực tiếp",
            Source: "#/guides",
            QuickReplies: ["Xem hướng dẫn", "Gặp nhân viên hỗ trợ"],
            Confidence: 0.0,
            CanEscalate: true
        );
    }

    public static FaqTopicResponse GetFaq(string? topic)
    {
        var t = topic?.ToLowerInvariant().Trim() ?? "";
        var relevant = string.IsNullOrEmpty(t)
            ? KnowledgeBase.Take(5).ToArray()
            : KnowledgeBase.Where(e => e.Keywords.Any(k => t.Contains(k) || k.Contains(t))).Take(6).ToArray();
        return new FaqTopicResponse(
            Items: relevant.Select(e => new FaqItem(e.Keywords.First(), e.Answer, e.Source)).ToArray()
        );
    }

    private static string BuildWelcome(string ctx) =>
        ctx switch
        {
            var c when c.Contains("product") =>
                "Xin chào! Tôi là **BidNet AI**.\nTôi thấy bạn đang xem trang sản phẩm. Tôi có thể giúp bạn về:\n• Cách đặt giá và bước giá\n• Thời gian phiên đấu giá\n• Quy định tham gia\n\nBạn cần hỗ trợ gì?",
            var c when c.Contains("order") =>
                "Xin chào! Tôi là **BidNet AI**.\nTôi có thể hỗ trợ bạn về đơn hàng:\n• Trạng thái đơn hàng\n• Cập nhật địa chỉ giao hàng\n• Thanh toán và xác nhận\n\nBạn đang gặp vấn đề gì?",
            var c when c.Contains("my-products") =>
                "Xin chào! Tôi là **BidNet AI**.\nTôi có thể hỗ trợ bạn về sản phẩm đang bán:\n• Trạng thái kiểm duyệt\n• Hủy phiên đấu giá\n• Đăng lại sản phẩm\n\nBạn cần hỗ trợ gì?",
            _ =>
                "Xin chào! Tôi là **BidNet AI** – trợ lý hỗ trợ tự động.\n\nTôi có thể giúp bạn về:\n• Hướng dẫn đấu giá và đặt giá\n• Đăng bán và quản lý sản phẩm\n• Tài khoản và bảo mật\n• Đơn hàng và thanh toán\n\nBạn đang cần trợ giúp về vấn đề gì?"
        };

    private static FaqEntry? FindBestMatch(string msg)
    {
        if (string.IsNullOrEmpty(msg)) return null;
        FaqEntry? best = null;
        int bestScore = 0;
        foreach (var entry in KnowledgeBase)
        {
            int score = entry.Keywords.Count(k => msg.Contains(k));
            if (score > bestScore) { bestScore = score; best = entry; }
        }
        return bestScore > 0 ? best : null;
    }
}

public record AiSuggestResponse(string Answer, string? Source, string[] QuickReplies, double Confidence, bool CanEscalate);
public record FaqItem(string Title, string Body, string? Link);
public record FaqTopicResponse(FaqItem[] Items);
