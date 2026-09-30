using BidNet.Data;
using BidNet.Hubs;
using BidNet.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class AuctionClosingService(
    IServiceScopeFactory scopeFactory, IHubContext<AuctionHub> hub,
    ILogger<AuctionClosingService> logger) : BackgroundService
{
    // Worker chạy độc lập với request HTTP để phiên tự chuyển trạng thái đúng giờ.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Chạy ngay một lượt lúc khởi động, sau đó quét mỗi 5 giây. Lỗi một lượt
        // được ghi log nhưng không làm worker dừng hẳn.
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            try { await ProcessAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Không xử lý được vòng đời phiên đấu giá."); }
            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        } while (true);
    }

    private async Task ProcessAsync(CancellationToken ct)
    {
        // BackgroundService là singleton, còn DbContext là scoped: mỗi lượt quét
        // tạo scope riêng để không dùng DbContext quá lâu hoặc giữa nhiều luồng.
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        // Mỗi lượt chỉ lấy tối đa 50 phiên đến giờ mở để không giữ DB quá lâu.
        // Lượt quét sau sẽ xử lý phần còn lại nếu số phiên lớn hơn 50.
        var pendingIds = await db.Products.AsNoTracking()
            .Where(p => p.Status == ProductStatus.Scheduled && p.StartTime <= now)
            .OrderBy(p => p.StartTime).Select(p => p.Id).Take(50).ToListAsync(ct);
        foreach (var id in pendingIds)
        {
            var product = await db.Products.FindAsync([id], ct);
            if (product is null || product.Status != ProductStatus.Scheduled) continue;
            product.Status = ProductStatus.Active;
            product.UpdatedAt = now;
            try { await db.SaveChangesAsync(ct); }
            // Worker/request khác có thể đã đổi phiên; RowVersion giúp bỏ qua
            // bản ghi cũ thay vì ghi đè trạng thái mới.
            catch (DbUpdateConcurrencyException) { db.Entry(product).State = EntityState.Detached; }
            db.Entry(product).State = EntityState.Detached;
        }

        // Chỉ đóng phiên Active đã qua EndTime, không đụng phiên đã hủy.
        var expiredIds = await db.Products.AsNoTracking()
            .Where(p => p.Status == ProductStatus.Active && p.EndTime <= now)
            .OrderBy(p => p.EndTime).Select(p => p.Id).Take(50).ToListAsync(ct);
        foreach (var id in expiredIds)
        {
            var product = await db.Products.FindAsync([id], ct);
            if (product is null || product.Status != ProductStatus.Active) continue;
            var winningBid = await db.Bids.AsNoTracking().Where(b => b.ProductId == id)
                // Giá cao nhất thắng. Nếu bằng giá, bid sớm hơn thắng; Id phá hòa
                // khi BidTime cũng trùng. Không có bid thì WinnerId để null.
                .OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                .FirstOrDefaultAsync(ct);
            product.WinnerId = winningBid?.UserId;
            product.Status = ProductStatus.Completed;
            product.UpdatedAt = now;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                // Phiên đã được request/worker khác thay đổi; bỏ kết quả tính trên
                // dữ liệu cũ và để lượt quét sau đọc lại trạng thái mới.
                db.Entry(product).State = EntityState.Detached;
                continue;
            }
            // Tách entity để DbContext không giữ bản đã xử lý sang vòng lặp kế.
            db.Entry(product).State = EntityState.Detached;
            try
            {
                // Thông báo cho người đang xem sau khi kết quả đã được lưu vào DB.
                await hub.Clients.Group(AuctionHub.GroupName(id))
                    .SendAsync("AuctionClosed", new { productId = id, status = "Completed",
                        winnerId = product.WinnerId }, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Không gửi được AuctionClosed cho phiên {ProductId}", id);
            }
        }
    }
}
