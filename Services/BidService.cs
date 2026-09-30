using BidNet.Data;
using BidNet.DTOs;
using BidNet.Hubs;
using BidNet.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class BidService(
    AppDbContext db, CurrentUser currentUser, IConfiguration config,
    IHubContext<AuctionHub> hub, ILogger<BidService> logger) : IBidService
{
    // Điểm ghi bid duy nhất: kiểm tra quyền, giá tối thiểu và chống tranh chấp.
    public async Task<BidResponseDto> PlaceAsync(int productId, decimal amount, CancellationToken ct)
    {
        // Không dựa vào trạng thái client hiển thị vì phiên có thể vừa đóng/mở.
        // Lấy thời gian UTC một lần cho toàn bộ quyết định và BidTime của lượt này.
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var now = DateTime.UtcNow;
        if (product.SellerId == user.Id)
            throw new ApiException(403, "seller_cannot_bid", "Người bán không được tự đặt giá.");
        if (product.Status != ProductStatus.Active || now < product.StartTime || now >= product.EndTime)
            throw new ApiException(409, "auction_not_active", "Phiên không nhận đặt giá tại thời điểm này.");

        // Bước giá lấy từ cấu hình chung; cấu hình sai là lỗi server, không phải
        // lỗi nhập liệu của người đặt giá.
        var increment = config.GetValue<decimal>("Auction:MinBidIncrement");
        if (increment < 1 || increment != decimal.Truncate(increment))
            throw new InvalidOperationException("Auction:MinBidIncrement phải là số nguyên VND dương.");
        if (amount <= 0 || amount != decimal.Truncate(amount) || amount > 9_999_999_999_999_999m)
            throw new ApiException(400, "invalid_bid", "Giá đặt phải là số nguyên VND dương.");

        var hasBid = await db.Bids.AnyAsync(b => b.ProductId == productId, ct);
        // Bid đầu tiên có thể bằng giá khởi điểm. Khi đã có bid, giá mới phải
        // cao hơn CurrentPrice ít nhất MinBidIncrement.
        var minimum = hasBid ? product.CurrentPrice + increment : product.StartingPrice;
        if (amount < minimum)
            throw new ApiException(400, "bid_too_low", $"Giá tối thiểu hiện tại là {minimum} VND.");

        var bid = new Bid { ProductId = productId, UserId = user.Id, Amount = amount, BidTime = now };
        db.Bids.Add(bid);
        product.CurrentPrice = amount;
        product.UpdatedAt = now;
        try
        {
            // EF lưu Bid và CurrentPrice trong cùng SaveChanges. RowVersion của
            // Product phát hiện request khác đã thắng cuộc đua ghi giá trước.
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Trả 409 để client tải giá hiện tại rồi đặt lại, không ghi đè giá mới.
            throw new ApiException(409, "bid_conflict", "Giá đã thay đổi, hãy tải lại và đặt giá mới.");
        }

        var response = ToResponse(bid);
        // Chỉ phát SignalR khi DB đã lưu thành công, tránh báo bid bị từ chối.
        try
        {
            await hub.Clients.Group(AuctionHub.GroupName(productId))
                .SendAsync("BidAccepted", new { productId, currentPrice = amount, bidTime = now }, ct);
        }
        catch (Exception ex)
        {
            // SignalR là thông báo phụ; lỗi gửi không được biến bid đã lưu thành
            // lỗi HTTP, nếu không client có thể gửi lại và tạo bid trùng.
            logger.LogWarning(ex, "Không gửi được sự kiện BidAccepted cho phiên {ProductId}", productId);
        }
        return response;
    }

    public async Task<PagedResponseDto<PublicBidDto>> ForProductAsync(
        int productId, int page, int pageSize, CancellationToken ct)
    {
        // Lịch sử công khai không lộ UserId. Sắp xếp mới nhất trước để người
        // xem thấy biến động gần đây; TotalCount được tính trước khi phân trang.
        if (!await db.Products.AnyAsync(p => p.Id == productId, ct))
            throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var args = PageArgs.Validate(page, pageSize);
        var query = db.Bids.AsNoTracking().Where(b => b.ProductId == productId);
        var count = await query.CountAsync(ct);
        var items = await query.OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(b => new PublicBidDto { Id = b.Id, Amount = b.Amount, BidTime = b.BidTime })
            .ToListAsync(ct);
        return new PagedResponseDto<PublicBidDto>
        {
            Items = items, Page = args.Page, PageSize = args.PageSize, TotalCount = count
        };
    }

    public async Task<PagedResponseDto<BidResponseDto>> MineAsync(int page, int pageSize, CancellationToken ct)
    {
        // Lịch sử cá nhân có UserId nhưng chỉ lọc theo chính người trong token.
        var user = await currentUser.RequireActiveAsync(ct);
        return await PageAsync(db.Bids.AsNoTracking().Where(b => b.UserId == user.Id), page, pageSize, ct);
    }

    private static async Task<PagedResponseDto<BidResponseDto>> PageAsync(
        IQueryable<Bid> query, int page, int pageSize, CancellationToken ct)
    {
        var args = PageArgs.Validate(page, pageSize);
        var count = await query.CountAsync(ct);
        var bids = await query.OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize).ToListAsync(ct);
        return new PagedResponseDto<BidResponseDto>
        {
            Items = bids.Select(ToResponse).ToList(),
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = count
        };
    }

    private static BidResponseDto ToResponse(Bid bid) => new()
    {
        Id = bid.Id,
        ProductId = bid.ProductId,
        UserId = bid.UserId,
        Amount = bid.Amount,
        BidTime = bid.BidTime
    };
}
