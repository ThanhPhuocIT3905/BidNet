using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class LiveAuctionRequestService(AppDbContext db, CurrentUser currentUser)
{
    private static readonly LiveAuctionRequestStatus[] ActiveStatuses =
    [
        LiveAuctionRequestStatus.PendingReview,
        LiveAuctionRequestStatus.Reviewing,
        LiveAuctionRequestStatus.RevisionRequested,
        LiveAuctionRequestStatus.AwaitingSellerConfirmation,
        LiveAuctionRequestStatus.Approved,
        LiveAuctionRequestStatus.Scheduled,
        LiveAuctionRequestStatus.Live
    ];

    public async Task<List<LiveAuctionEligibleProductDto>> EligibleProductsAsync(CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        var now = DateTime.UtcNow;
        return await db.Products.AsNoTracking()
            .Where(p => p.SellerId == seller.Id && p.AuctionType == ProductAuctionType.Timed &&
                p.Status == ProductStatus.Scheduled &&
                p.StartTime > now && !p.Bids.Any() &&
                !db.Orders.Any(o => o.ProductId == p.Id) &&
                !db.LiveLots.Any(l => l.ProductId == p.Id &&
                    l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped &&
                    l.Status != LiveLotStatus.Withdrawn) &&
                !db.LiveAuctionRequests.Any(r => r.ProductId == p.Id && ActiveStatuses.Contains(r.Status)))
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new LiveAuctionEligibleProductDto
            {
                Id = p.Id,
                Name = p.Name,
                ImageUrl = p.ImageUrl,
                Category = p.Category,
                StartingPrice = p.StartingPrice,
                StartTime = p.StartTime
            })
            .Take(100)
            .ToListAsync(ct);
    }

    public async Task<LiveAuctionRequestDto> CreateAsync(CreateLiveAuctionRequestDto input, CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        ValidateTerms(input.ProposedStartingPrice, input.ProposedReservePrice, input.ProposedBidIncrement);
        if (!input.SellerConsent)
            throw new ApiException(400, "seller_consent_required",
                "Xác nhận đồng ý tham gia đấu giá trực tiếp là bắt buộc.");

        var product = await db.Products.Include(p => p.Seller)
            .FirstOrDefaultAsync(p => p.Id == input.ProductId && p.SellerId == seller.Id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm thuộc tài khoản của bạn.");
        var now = DateTime.UtcNow;
        if (product.AuctionType != ProductAuctionType.Timed ||
            product.Status != ProductStatus.Scheduled || product.StartTime <= now ||
            await db.Bids.AnyAsync(b => b.ProductId == product.Id, ct) ||
            await db.Orders.AnyAsync(o => o.ProductId == product.Id, ct) ||
            await db.LiveLots.AnyAsync(l => l.ProductId == product.Id &&
                l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped &&
                l.Status != LiveLotStatus.Withdrawn, ct) ||
            await db.LiveAuctionRequests.AnyAsync(r => r.ProductId == product.Id &&
                ActiveStatuses.Contains(r.Status), ct))
            throw new ApiException(409, "product_unavailable",
                "Sản phẩm đã bắt đầu, có giao dịch hoặc đang được xử lý trong một luồng đấu giá khác.");

        LiveEvent? preferredEvent = null;
        if (input.PreferredEventId is int eventId)
        {
            preferredEvent = await db.LiveEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct)
                ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện được chọn.");
            if (preferredEvent.Status is not (LiveEventStatus.Draft or LiveEventStatus.Published))
                throw new ApiException(409, "event_unavailable", "Sự kiện này không còn nhận đề xuất sản phẩm.");
        }

        var request = new LiveAuctionRequest
        {
            RequestCode = $"LVR-{now:yyMMdd}-{Guid.NewGuid():N}".ToUpperInvariant(),
            Product = product,
            ProductId = product.Id,
            Seller = seller,
            SellerId = seller.Id,
            ProposedStartingPrice = input.ProposedStartingPrice,
            ProposedReservePrice = input.ProposedReservePrice,
            ProposedBidIncrement = input.ProposedBidIncrement,
            PreferredEvent = preferredEvent,
            PreferredEventId = preferredEvent?.Id,
            SellerNote = input.SellerNote?.Trim(),
            SellerConfirmedAt = now,
            TermsVersion = 1,
            AcceptedTermsVersion = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        product.AuctionType = ProductAuctionType.Live;
        product.UpdatedAt = now;
        db.LiveAuctionRequests.Add(request);
        await NotifyAdminsAsync(request, "Có yêu cầu đấu giá trực tiếp mới",
            $"Người bán {seller.Username} gửi yêu cầu cho sản phẩm “{product.Name}”.", now, ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "product_changed", "Sản phẩm vừa thay đổi. Hãy tải lại và gửi lại yêu cầu.");
        }
        catch (DbUpdateException)
        {
            throw new ApiException(409, "request_conflict", "Sản phẩm đã có yêu cầu đấu giá trực tiếp đang xử lý.");
        }
        return ToDto(await Query().FirstAsync(r => r.Id == request.Id, ct));
    }

    public async Task<List<LiveAuctionRequestDto>> MineAsync(CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        return (await Query().Where(r => r.SellerId == seller.Id)
            .OrderByDescending(r => r.CreatedAt).ToListAsync(ct))
            .Select(ToDto).ToList();
    }

    public async Task<LiveAuctionRequestDto> UpdateAndResubmitAsync(
        int id, UpdateLiveAuctionRequestDto input, CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        ValidateTerms(input.ProposedStartingPrice, input.ProposedReservePrice, input.ProposedBidIncrement);
        var request = await db.LiveAuctionRequests.FirstOrDefaultAsync(r => r.Id == id && r.SellerId == seller.Id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status != LiveAuctionRequestStatus.RevisionRequested)
            throw new ApiException(409, "invalid_status", "Chỉ yêu cầu cần bổ sung mới được chỉnh sửa và gửi lại.");
        request.ProposedStartingPrice = input.ProposedStartingPrice;
        request.ProposedReservePrice = input.ProposedReservePrice;
        request.ProposedBidIncrement = input.ProposedBidIncrement;
        request.SellerNote = input.SellerNote?.Trim();
        request.TermsVersion++;
        request.AcceptedTermsVersion = request.TermsVersion;
        request.SellerConfirmedAt = DateTime.UtcNow;
        request.AdminNote = null;
        request.RejectReason = null;
        request.Status = LiveAuctionRequestStatus.PendingReview;
        request.UpdatedAt = DateTime.UtcNow;
        await NotifyAdminsAsync(request, "Người bán đã bổ sung yêu cầu đấu giá trực tiếp",
            $"Yêu cầu {request.RequestCode} đã được gửi lại để xét duyệt.", request.UpdatedAt, ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "request_changed", "Yêu cầu vừa được cập nhật bởi Admin. Hãy tải lại.");
        }
        return ToDto(await Query().FirstAsync(r => r.Id == id, ct));
    }

    public async Task<LiveAuctionRequestDto> ConfirmTermsAsync(int id, CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        var request = await db.LiveAuctionRequests.FirstOrDefaultAsync(r => r.Id == id && r.SellerId == seller.Id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status != LiveAuctionRequestStatus.AwaitingSellerConfirmation)
            throw new ApiException(409, "invalid_status", "Yêu cầu hiện không chờ bạn xác nhận điều kiện.");
        request.AcceptedTermsVersion = request.TermsVersion;
        request.SellerConfirmedAt = DateTime.UtcNow;
        request.Status = LiveAuctionRequestStatus.Approved;
        request.UpdatedAt = DateTime.UtcNow;
        await NotifyAdminsAsync(request, "Người bán đã xác nhận điều kiện Live Auction",
            $"Yêu cầu {request.RequestCode} đã sẵn sàng xếp lịch.", request.UpdatedAt, ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "request_changed", "Điều kiện vừa thay đổi. Hãy tải lại trước khi xác nhận.");
        }
        return ToDto(await Query().FirstAsync(r => r.Id == id, ct));
    }

    public async Task WithdrawAsync(int id, CancellationToken ct)
    {
        var seller = await currentUser.RequireMemberAsync(ct);
        var request = await db.LiveAuctionRequests.Include(r => r.Product)
            .FirstOrDefaultAsync(r => r.Id == id && r.SellerId == seller.Id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status is not (LiveAuctionRequestStatus.PendingReview or LiveAuctionRequestStatus.Reviewing or
            LiveAuctionRequestStatus.RevisionRequested or LiveAuctionRequestStatus.AwaitingSellerConfirmation or
            LiveAuctionRequestStatus.Approved))
            throw new ApiException(409, "invalid_status", "Yêu cầu đã được xếp lịch hoặc kết thúc nên không thể rút.");
        if (await db.LiveLots.AnyAsync(l => l.LiveAuctionRequestId == id, ct))
            throw new ApiException(409, "request_scheduled", "Hãy liên hệ Admin để xử lý yêu cầu đã được xếp vào sự kiện.");
        request.Status = LiveAuctionRequestStatus.Withdrawn;
        request.Product.AuctionType = ProductAuctionType.Timed;
        request.Product.UpdatedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        await NotifyAdminsAsync(request, "Người bán đã rút yêu cầu Live Auction",
            $"Yêu cầu {request.RequestCode} đã được người bán rút.", request.UpdatedAt, ct);
        await SaveRequestAsync(ct);
    }

    public async Task<List<LiveAuctionRequestDto>> AdminListAsync(string? status, string? q, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var query = Query();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<LiveAuctionRequestStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new ApiException(400, "invalid_status", "Trạng thái yêu cầu không hợp lệ.");
            query = query.Where(r => r.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(r => r.RequestCode.Contains(term) || r.Product.Name.Contains(term) ||
                r.Seller.Username.Contains(term));
        }
        return (await query.OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct))
            .Select(ToDto).ToList();
    }

    public async Task<LiveAuctionRequestDto> AdminGetAsync(int id, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        return ToDto(await Query().FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu."));
    }

    public async Task<LiveAuctionRequestDto> StartReviewAsync(int id, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        var request = await db.LiveAuctionRequests.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status is not (LiveAuctionRequestStatus.PendingReview or LiveAuctionRequestStatus.RevisionRequested))
            throw new ApiException(409, "invalid_status", "Yêu cầu hiện không thể tiếp nhận xét duyệt.");
        request.Status = LiveAuctionRequestStatus.Reviewing;
        request.ReviewedById = admin.Id;
        request.ReviewedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        AddSellerNotification(request, "Yêu cầu Live Auction đang được xét duyệt",
            $"Admin đã tiếp nhận yêu cầu {request.RequestCode}.", request.UpdatedAt);
        await SaveRequestAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task<LiveAuctionRequestDto> ApproveAsync(int id, ReviewLiveAuctionRequestDto input, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        ValidateTerms(input.ProposedStartingPrice, input.ProposedReservePrice, input.ProposedBidIncrement);
        var request = await db.LiveAuctionRequests.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status is not (LiveAuctionRequestStatus.PendingReview or LiveAuctionRequestStatus.Reviewing))
            throw new ApiException(409, "invalid_status", "Yêu cầu hiện không thể phê duyệt.");
        var termsChanged = request.ProposedStartingPrice != input.ProposedStartingPrice ||
            request.ProposedReservePrice != input.ProposedReservePrice ||
            request.ProposedBidIncrement != input.ProposedBidIncrement;
        request.ProposedStartingPrice = input.ProposedStartingPrice;
        request.ProposedReservePrice = input.ProposedReservePrice;
        request.ProposedBidIncrement = input.ProposedBidIncrement;
        request.AdminNote = input.AdminNote?.Trim();
        request.ReviewedById = admin.Id;
        request.ReviewedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        if (termsChanged)
        {
            request.TermsVersion++;
            request.AcceptedTermsVersion = null;
            request.SellerConfirmedAt = null;
            request.Status = LiveAuctionRequestStatus.AwaitingSellerConfirmation;
        }
        else
        {
            request.Status = LiveAuctionRequestStatus.Approved;
        }
        AddSellerNotification(request, termsChanged
                ? "Cần xác nhận điều kiện đấu giá trực tiếp"
                : "Yêu cầu đấu giá trực tiếp đã được duyệt",
            termsChanged
                ? $"Admin đề xuất điều kiện mới cho yêu cầu {request.RequestCode}. Vui lòng xem và xác nhận."
                : $"Yêu cầu {request.RequestCode} đã được duyệt và sẵn sàng xếp lịch.",
            request.UpdatedAt);
        await SaveRequestAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task<LiveAuctionRequestDto> RequestRevisionAsync(int id, LiveAuctionRequestMessageDto input, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        var message = RequiredMessage(input.Message);
        var request = await db.LiveAuctionRequests.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status is not (LiveAuctionRequestStatus.PendingReview or LiveAuctionRequestStatus.Reviewing))
            throw new ApiException(409, "invalid_status", "Yêu cầu hiện không thể yêu cầu bổ sung.");
        request.Status = LiveAuctionRequestStatus.RevisionRequested;
        request.AdminNote = message;
        request.ReviewedById = admin.Id;
        request.ReviewedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        AddSellerNotification(request, "Yêu cầu Live Auction cần bổ sung thông tin",
            $"Yêu cầu {request.RequestCode}: {message}", request.UpdatedAt);
        await SaveRequestAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task<LiveAuctionRequestDto> RejectAsync(int id, LiveAuctionRequestMessageDto input, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        var reason = RequiredMessage(input.Message);
        var request = await db.LiveAuctionRequests.Include(r => r.Product)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu.");
        if (request.Status is not (LiveAuctionRequestStatus.PendingReview or LiveAuctionRequestStatus.Reviewing))
            throw new ApiException(409, "invalid_status", "Yêu cầu hiện không thể từ chối.");
        request.Status = LiveAuctionRequestStatus.Rejected;
        request.Product.AuctionType = ProductAuctionType.Timed;
        request.Product.UpdatedAt = DateTime.UtcNow;
        request.RejectReason = reason;
        request.AdminNote = reason;
        request.ReviewedById = admin.Id;
        request.ReviewedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        AddSellerNotification(request, "Yêu cầu đấu giá trực tiếp bị từ chối",
            $"Yêu cầu {request.RequestCode}: {reason}", request.UpdatedAt);
        await SaveRequestAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task<List<LiveProductOptionDto>> InventoryAsync(string? q, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var query = db.LiveAuctionRequests.AsNoTracking()
            .Where(r => r.Status == LiveAuctionRequestStatus.Approved &&
                r.SellerConfirmedAt != null && r.AcceptedTermsVersion == r.TermsVersion &&
                r.Product.AuctionType == ProductAuctionType.Live &&
                r.Product.Status == ProductStatus.Scheduled &&
                !r.Product.Bids.Any() && !db.Orders.Any(o => o.ProductId == r.ProductId) &&
                !db.LiveLots.Any(l => l.ProductId == r.ProductId &&
                    l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped &&
                    l.Status != LiveLotStatus.Withdrawn));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(r => r.Product.Name.Contains(term) || r.Seller.Username.Contains(term) ||
                r.RequestCode.Contains(term));
        }
        return await query.OrderByDescending(r => r.UpdatedAt).Take(100)
            .Select(r => new LiveProductOptionDto
            {
                Id = r.ProductId,
                RequestId = r.Id,
                RequestCode = r.RequestCode,
                Name = r.Product.Name,
                StartingPrice = r.ProposedStartingPrice,
                ReservePrice = r.ProposedReservePrice,
                BidIncrement = r.ProposedBidIncrement,
                ImageUrl = db.ProductImages.Where(i => i.ProductId == r.ProductId)
                    .OrderBy(i => i.Id).Select(i => i.CloudinaryUrl).FirstOrDefault() ?? r.Product.ImageUrl,
                Category = r.Product.Category,
                SellerId = r.SellerId,
                SellerName = r.Seller.Username
            }).ToListAsync(ct);
    }

    private IQueryable<LiveAuctionRequest> Query() => db.LiveAuctionRequests.AsNoTracking()
        .Include(r => r.Product)
        .Include(r => r.Seller)
        .Include(r => r.ReviewedBy)
        .Include(r => r.PreferredEvent)
        .Include(r => r.ScheduledEvent);

    private static LiveAuctionRequestDto ToDto(LiveAuctionRequest request) => new()
    {
        Id = request.Id,
        RequestCode = request.RequestCode,
        ProductId = request.ProductId,
        ProductName = request.Product.Name,
        ProductImageUrl = request.Product.ImageUrl,
        Category = request.Product.Category,
        SellerId = request.SellerId,
        SellerName = request.Seller.Username,
        SellerAvatarUrl = request.Seller.AvatarUrl,
        Status = request.Status.ToString(),
        ProposedStartingPrice = request.ProposedStartingPrice,
        ProposedReservePrice = request.ProposedReservePrice,
        ProposedBidIncrement = request.ProposedBidIncrement,
        PreferredEventId = request.PreferredEventId,
        PreferredEventTitle = request.PreferredEvent?.Title,
        SellerNote = request.SellerNote,
        AdminNote = request.AdminNote,
        RejectReason = request.RejectReason,
        TermsVersion = request.TermsVersion,
        AcceptedTermsVersion = request.AcceptedTermsVersion,
        SellerConfirmedAt = request.SellerConfirmedAt,
        ReviewedAt = request.ReviewedAt,
        ReviewerName = request.ReviewedBy?.Username,
        ScheduledEventId = request.ScheduledEventId,
        ScheduledEventTitle = request.ScheduledEvent?.Title,
        CreatedAt = request.CreatedAt
    };

    private async Task NotifyAdminsAsync(LiveAuctionRequest request, string title, string message,
        DateTime createdAt, CancellationToken ct)
    {
        var adminIds = await db.Users.AsNoTracking()
            .Where(u => u.Role == "Admin" && u.IsActive)
            .Select(u => u.Id).ToListAsync(ct);
        db.Notifications.AddRange(adminIds.Select(id => new Notification
        {
            UserId = id,
            ProductId = request.ProductId,
            Title = title,
            Message = message,
            CreatedAt = createdAt
        }));
    }

    private void AddSellerNotification(LiveAuctionRequest request, string title, string message, DateTime createdAt) =>
        db.Notifications.Add(new Notification
        {
            UserId = request.SellerId,
            ProductId = request.ProductId,
            Title = title,
            Message = message,
            CreatedAt = createdAt
        });

    private async Task SaveRequestAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "request_changed", "Yêu cầu vừa được cập nhật bởi người khác. Hãy tải lại.");
        }
    }

    private static string RequiredMessage(string message)
    {
        var cleaned = message.Trim();
        if (cleaned.Length == 0)
            throw new ApiException(400, "message_required", "Vui lòng nhập nội dung phản hồi.");
        return cleaned;
    }

    private static void ValidateTerms(decimal starting, decimal? reserve, decimal increment)
    {
        if (starting < 1000 || starting != decimal.Truncate(starting) || starting > 100_000_000_000m)
            throw new ApiException(400, "invalid_price", "Giá khởi điểm phải là số nguyên VND từ 1.000.");
        if (increment < 1 || increment != decimal.Truncate(increment) || increment > 100_000_000_000m)
            throw new ApiException(400, "invalid_increment", "Bước giá phải là số nguyên VND dương.");
        if (reserve is decimal value && (value < starting || value != decimal.Truncate(value)))
            throw new ApiException(400, "invalid_reserve", "Giá dự trữ phải là số nguyên và không thấp hơn giá khởi điểm.");
    }
}
