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
        var user = await currentUser.RequireMemberAsync(ct);
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var now = DateTime.UtcNow;
        if (product.SellerId == user.Id)
            throw new ApiException(403, "seller_cannot_bid", "Người bán không được tự đặt giá.");
        if (product.AuctionType != ProductAuctionType.Timed)
            throw new ApiException(409, "live_auction_only", "Sản phẩm đang được xử lý theo hình thức đấu giá trực tiếp.");
        // Sản phẩm đang nằm trong một lô live chỉ nhận giá trong phòng live.
        if (await db.LiveLots.AnyAsync(l => l.ProductId == productId &&
                l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped &&
                l.Status != LiveLotStatus.Withdrawn, ct))
            throw new ApiException(409, "live_lot_product", "Sản phẩm đang đấu giá trực tiếp, vui lòng đặt giá trong phòng đấu giá.");
        if (product.Status != ProductStatus.Active || now < product.StartTime || now >= product.EndTime)
            throw new ApiException(409, "auction_not_active", "Phiên không nhận đặt giá tại thời điểm này.");

        // Bước giá lấy từ cấu hình chung; cấu hình sai là lỗi server, không phải
        // lỗi nhập liệu của người đặt giá.
        var increment = config.GetValue<decimal>("Auction:MinBidIncrement");
        if (increment < 1 || increment != decimal.Truncate(increment))
            throw new InvalidOperationException("Auction:MinBidIncrement phải là số nguyên VND dương.");
        if (amount <= 0 || amount != decimal.Truncate(amount) || amount > 100_000_000_000m)
            throw new ApiException(400, "invalid_bid", "Giá đặt phải là số nguyên VND dương.");

        var hasBid = await db.Bids.AnyAsync(b => b.ProductId == productId, ct);
        // Bid đầu tiên có thể bằng giá khởi điểm. Khi đã có bid, giá mới phải
        // cao hơn CurrentPrice ít nhất MinBidIncrement.
        var minimum = hasBid ? product.CurrentPrice + increment : product.StartingPrice;
        if (amount < minimum)
            throw new ApiException(400, "bid_too_low", $"Giá tối thiểu hiện tại là {minimum} VND.");
        // Giá phải nhảy đúng bội số của bước giá tính từ mức tối thiểu, ví dụ
        // tối thiểu 101.000 + bước 1.000 thì chỉ nhận 101.000, 102.000, …
        if ((amount - minimum) % increment != 0)
            throw new ApiException(400, "bid_increment", $"Giá đặt phải tăng theo bước giá {increment:N0} VND.");

        // Tìm người đang giữ giá cao nhất TRƯỚC lượt này (không loại trừ ai) để gửi
        // thông báo bị vượt giá. Nếu chính người đang dẫn đầu tự nâng giá thì không
        // gửi, tránh báo nhầm cho người giữ giá thứ hai.
        var previousBidderId = await db.Bids.AsNoTracking()
            .Where(b => b.ProductId == productId)
            .OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
            .Select(b => (int?)b.UserId)
            .FirstOrDefaultAsync(ct);

        var bid = new Bid { ProductId = productId, UserId = user.Id, Amount = amount, BidTime = now };
        db.Bids.Add(bid);
        product.CurrentPrice = amount;
        product.UpdatedAt = now;

        // Chỉ báo "bị vượt giá" khi người dẫn đầu trước đó KHÔNG phải chính mình.
        if (previousBidderId.HasValue && previousBidderId.Value != user.Id)
        {
            db.Notifications.Add(new Notification
            {
                UserId = previousBidderId.Value,
                ProductId = productId,
                Title = "Giá đấu bị vượt!",
                Message = $"Mức giá của bạn cho sản phẩm '{product.Name}' đã bị người khác vượt qua với giá {amount:N0} VNĐ.",
                CreatedAt = now
            });
        }

        // Tự động tạo thông báo gửi tới người bán sản phẩm
        db.Notifications.Add(new Notification
        {
            UserId = product.SellerId,
            ProductId = productId,
            Title = "Lượt đặt giá mới",
            Message = $"Sản phẩm '{product.Name}' của bạn vừa có lượt đặt giá mới: {amount:N0} VNĐ.",
            CreatedAt = now
        });

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
        response.BidderName = user.Username;
        // Chỉ phát SignalR khi DB đã lưu thành công, tránh báo bid bị từ chối.
        try
        {
            await hub.Clients.Group(AuctionHub.GroupName(productId))
                .SendAsync("BidAccepted", new
                {
                    productId,
                    bidId = bid.Id,
                    currentPrice = amount,
                    minimumBid = amount + increment,
                    bidCount = await db.Bids.CountAsync(b => b.ProductId == productId, ct),
                    bidTime = now,
                    bidderName = user.Username
                }, ct);
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
        // Sắp xếp mới nhất trước để người xem thấy biến động gần đây.
        if (!await db.Products.AnyAsync(p => p.Id == productId, ct))
            throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var args = PageArgs.Validate(page, pageSize);
        var query = db.Bids.AsNoTracking().Where(b => b.ProductId == productId);
        var count = await query.CountAsync(ct);
        var items = await query.OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(b => new PublicBidDto
            {
                Id = b.Id,
                Amount = b.Amount,
                BidTime = b.BidTime,
                BidderName = b.User.Username
            })
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
        var args = PageArgs.Validate(page, pageSize);
        var query = db.Bids.AsNoTracking().Where(b => b.UserId == user.Id);
        var count = await query.CountAsync(ct);
        var items = await query.OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(b => new BidResponseDto
            {
                Id = b.Id,
                ProductId = b.ProductId,
                UserId = b.UserId,
                Amount = b.Amount,
                BidTime = b.BidTime,
                BidderName = b.User.Username,
                ProductName = b.Product.Name,
                ProductStatus = b.Product.Status.ToString(),
                CurrentPrice = b.Product.CurrentPrice,
                WinnerId = b.Product.WinnerId,
                LeadingBidderId = b.Product.Bids
                    .OrderByDescending(current => current.Amount)
                    .ThenBy(current => current.BidTime)
                    .ThenBy(current => current.Id)
                    .Select(current => (int?)current.UserId)
                    .FirstOrDefault(),
                IsLeading = b.Product.Status == ProductStatus.Active &&
                    b.Product.Bids.OrderByDescending(current => current.Amount)
                        .ThenBy(current => current.BidTime).ThenBy(current => current.Id)
                        .Select(current => (int?)current.Id).FirstOrDefault() == b.Id,
                IsWinner = b.Product.Status == ProductStatus.Completed &&
                    b.Product.WinnerId == user.Id &&
                    b.Product.Bids.OrderByDescending(current => current.Amount)
                        .ThenBy(current => current.BidTime).ThenBy(current => current.Id)
                        .Select(current => (int?)current.Id).FirstOrDefault() == b.Id
            })
            .ToListAsync(ct);
        return new PagedResponseDto<BidResponseDto>
        {
            Items = items,
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = count
        };
    }

    public async Task<MyAuctionsResponseDto> MyAuctionsAsync(
        int page, int pageSize, string? status, string? q, DateTime? from, DateTime? to, string? sort,
        CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        var participated = db.Products.AsNoTracking()
            .Where(p => p.Bids.Any(b => b.UserId == user.Id));

        var summary = await participated.GroupBy(_ => 1)
            .Select(group => new MyAuctionsSummaryDto
            {
                Total = group.Count(),
                Scheduled = group.Count(p => p.Status == ProductStatus.Scheduled),
                Leading = group.Count(p => p.Status == ProductStatus.Active &&
                    p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() == user.Id),
                Outbid = group.Count(p => p.Status == ProductStatus.Active &&
                    p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() != user.Id),
                Won = group.Count(p => p.Status == ProductStatus.Completed && p.WinnerId == user.Id),
                Lost = group.Count(p => p.Status == ProductStatus.Completed &&
                    p.WinnerId != null && p.WinnerId != user.Id),
                Unsold = group.Count(p => p.Status == ProductStatus.Completed && p.WinnerId == null),
                Cancelled = group.Count(p => p.Status == ProductStatus.Cancelled)
            })
            .SingleOrDefaultAsync(ct) ?? new MyAuctionsSummaryDto();

        var query = participated;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var hasProductId = int.TryParse(term, out var productId);
            query = query.Where(p => p.Name.Contains(term) ||
                (p.Category != null && p.Category.Contains(term)) ||
                (hasProductId && p.Id == productId));
        }

        if (from.HasValue)
        {
            var fromDate = from.Value.Date;
            query = query.Where(p => p.Bids.Where(b => b.UserId == user.Id)
                .Max(b => (DateTime?)b.BidTime) >= fromDate);
        }
        if (to.HasValue)
        {
            var until = to.Value.Date.AddDays(1);
            query = query.Where(p => p.Bids.Where(b => b.UserId == user.Id)
                .Max(b => (DateTime?)b.BidTime) < until);
        }

        switch (status?.Trim().ToLowerInvariant())
        {
            case "scheduled":
                query = query.Where(p => p.Status == ProductStatus.Scheduled);
                break;
            case "leading":
                query = query.Where(p => p.Status == ProductStatus.Active &&
                    p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() == user.Id);
                break;
            case "outbid":
                query = query.Where(p => p.Status == ProductStatus.Active &&
                    p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() != user.Id);
                break;
            case "won":
                query = query.Where(p => p.Status == ProductStatus.Completed && p.WinnerId == user.Id);
                break;
            case "lost":
                query = query.Where(p => p.Status == ProductStatus.Completed &&
                    p.WinnerId != null && p.WinnerId != user.Id);
                break;
            case "unsold":
                query = query.Where(p => p.Status == ProductStatus.Completed && p.WinnerId == null);
                break;
            case "cancelled":
                query = query.Where(p => p.Status == ProductStatus.Cancelled);
                break;
            case null:
            case "":
            case "all":
                break;
            default:
                throw new ApiException(400, "invalid_status", "Trạng thái phiên đấu giá không hợp lệ.");
        }

        var totalCount = await query.CountAsync(ct);
        IOrderedQueryable<Product> ordered = sort?.Trim().ToLowerInvariant() switch
        {
            "ending_soon" => query.OrderBy(p => p.EndTime),
            "price_high" => query.OrderByDescending(p => p.CurrentPrice),
            "price_low" => query.OrderBy(p => p.CurrentPrice),
            _ => query.OrderByDescending(p => p.Bids.Where(b => b.UserId == user.Id)
                .Max(b => (DateTime?)b.BidTime))
        };
        var items = await ordered.ThenByDescending(p => p.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(p => new MyAuctionDto
            {
                AuctionId = p.Id,
                ProductId = p.Id,
                ProductName = p.Name,
                ProductImageUrl = p.ImageUrl,
                AuctionType = "Regular",
                AuctionStatus = p.Status.ToString(),
                ParticipantStatus = p.Status == ProductStatus.Cancelled ? "Cancelled"
                    : p.Status == ProductStatus.Scheduled ? "Scheduled"
                    : p.Status == ProductStatus.Completed
                        ? p.WinnerId == user.Id ? "Won" : p.WinnerId == null ? "Unsold" : "Lost"
                    : p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() == user.Id ? "Leading" : "Outbid",
                StartingPrice = p.StartingPrice,
                CurrentPrice = p.CurrentPrice,
                MyHighestBid = p.Bids.Where(b => b.UserId == user.Id)
                    .Max(b => (decimal?)b.Amount) ?? 0,
                WinningPrice = p.WinnerId == null ? null : p.CurrentPrice,
                MyBidCount = p.Bids.Count(b => b.UserId == user.Id),
                TotalBidCount = p.Bids.Count(),
                IsLeading = p.Status == ProductStatus.Active &&
                    p.Bids.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                        .Select(b => (int?)b.UserId).FirstOrDefault() == user.Id,
                IsWinner = p.WinnerId == user.Id,
                StartTime = p.StartTime,
                EndTime = p.EndTime,
                LastBidAt = p.Bids.Where(b => b.UserId == user.Id)
                    .Max(b => (DateTime?)b.BidTime) ?? p.CreatedAt,
                OrderId = db.Orders.Where(o => o.ProductId == p.Id && o.BuyerId == user.Id)
                    .Select(o => (int?)o.Id).FirstOrDefault(),
                CancellationReason = p.CancellationReason
            })
            .ToListAsync(ct);

        return new MyAuctionsResponseDto
        {
            Items = items,
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = totalCount,
            Summary = summary
        };
    }

    public async Task<PagedResponseDto<MyAuctionBidHistoryDto>> MyAuctionBidsAsync(
        int productId, int page, int pageSize, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId && p.Bids.Any(b => b.UserId == user.Id))
            .Select(p => new { p.Status, p.WinnerId })
            .FirstOrDefaultAsync(ct)
            ?? throw new ApiException(404, "auction_not_found", "Không tìm thấy phiên đấu giá đã tham gia.");

        var query = db.Bids.AsNoTracking()
            .Where(b => b.ProductId == productId && b.UserId == user.Id);
        var count = await query.CountAsync(ct);
        var winningBidId = product.Status == ProductStatus.Completed && product.WinnerId == user.Id
            ? await query.OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                .Select(b => (int?)b.Id).FirstOrDefaultAsync(ct)
            : null;
        var leadingBidId = product.Status == ProductStatus.Active
            ? await db.Bids.AsNoTracking().Where(b => b.ProductId == productId)
                .OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
                .Select(b => (int?)b.Id).FirstOrDefaultAsync(ct)
            : null;
        var items = await query.OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(b => new MyAuctionBidHistoryDto
            {
                Id = b.Id,
                Amount = b.Amount,
                BidTime = b.BidTime,
                IsLeading = leadingBidId == b.Id,
                IsWinner = winningBidId == b.Id
            })
            .ToListAsync(ct);
        return new PagedResponseDto<MyAuctionBidHistoryDto>
        {
            Items = items,
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
