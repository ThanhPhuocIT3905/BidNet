using BidNet.Data;
using BidNet.DTOs;
using BidNet.Hubs;
using BidNet.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

// Nghiệp vụ đấu giá trực tiếp: một sự kiện mở lần lượt từng lô.
// Backend luôn là nơi quyết định giá hợp lệ, người dẫn đầu và kết quả chốt.
public class LiveAuctionService(
    AppDbContext db, CurrentUser currentUser, IConfiguration config,
    IHubContext<LiveAuctionHub> hub, ILogger<LiveAuctionService> logger)
{
    private int WarningIntervalSeconds =>
        Math.Clamp(config.GetValue<int?>("LiveAuction:MinWarningIntervalSeconds") ?? 5, 1, 300);

    private static string Mask(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Ẩn danh";
        return name.Length <= 3 ? $"{name[..1]}***" : $"{name[..3]}***";
    }

    private static T Summary<T>(LiveEvent e, LiveRegistration? registration, int lotCount, int soldCount, int currentLotNumber)
        where T : LiveEventSummaryDto, new() => new()
    {
        Id = e.Id,
        Code = e.Code,
        Title = e.Title,
        Description = e.Description,
        BannerUrl = e.BannerUrl,
        Status = e.Status.ToString(),
        ScheduledStartAt = e.ScheduledStartAt,
        ScheduledEndAt = e.ScheduledEndAt,
        RegistrationOpen = e.RegistrationOpen,
        BuyerPremiumRate = e.BuyerPremiumRate,
        LotCount = lotCount,
        SoldCount = soldCount,
        CurrentLotId = e.CurrentLotId,
        CurrentLotNumber = currentLotNumber,
        MyRegistrationStatus = registration?.Status.ToString(),
        AuctioneerName = e.CreatedBy?.Username
    };

    private LiveLotDto LotDto(LiveLot lot, User? viewer)
    {
        var minimum = lot.BidCount == 0 ? lot.StartingPrice : lot.CurrentPrice + lot.BidIncrement;
        var hasBid = viewer != null && lot.Bids.Any(b => b.UserId == viewer.Id);
        var myStatus = lot.WinnerId == viewer?.Id ? "Won"
            : lot.Status == LiveLotStatus.Open && lot.LeadingBidderId == viewer?.Id ? "Leading"
            : hasBid ? "Outbid" : null;
        return new LiveLotDto
        {
            Id = lot.Id,
            EventId = lot.EventId,
            ProductId = lot.ProductId,
            LiveAuctionRequestId = lot.LiveAuctionRequestId,
            RequestCode = lot.LiveAuctionRequest?.RequestCode,
            LotNumber = lot.LotNumber,
            SequenceNumber = lot.SequenceNumber,
            Title = lot.Title,
            Description = lot.Description,
            ImageUrl = lot.ImageUrl,
            StartingPrice = lot.StartingPrice,
            CurrentPrice = lot.CurrentPrice,
            ReservePrice = lot.ReservePrice,
            BidIncrement = lot.BidIncrement,
            MinimumBid = minimum,
            NextBid = minimum,
            HammerPrice = lot.HammerPrice,
            Status = lot.Status.ToString(),
            CallingStage = lot.CallingStage.ToString(),
            WarningAvailableAt = lot.CallingStage == LiveCallingStage.Once && lot.LastWarningAt is DateTime lastWarningAt
                ? lastWarningAt.AddSeconds(WarningIntervalSeconds)
                : null,
            SellerName = lot.Seller?.Username ?? string.Empty,
            WinnerId = lot.WinnerId,
            WinnerName = lot.Winner?.Username,
            LeadingBidderCode = Mask(lot.LeadingBidder?.Username),
            MyStatus = myStatus,
            BidCount = lot.BidCount,
            OpenedAt = lot.OpenedAt,
            ClosedAt = lot.ClosedAt,
            ReserveMet = lot.ReservePrice is null || lot.CurrentPrice >= lot.ReservePrice
        };
    }

    private IQueryable<LiveEvent> EventQuery() => db.LiveEvents.AsNoTracking()
        .Include(e => e.CreatedBy)
        .Include(e => e.Registrations)
        .Include(e => e.Lots).ThenInclude(l => l.Seller)
        .Include(e => e.Lots).ThenInclude(l => l.Winner)
        .Include(e => e.Lots).ThenInclude(l => l.LeadingBidder)
        .Include(e => e.Lots).ThenInclude(l => l.LiveAuctionRequest)
        .Include(e => e.Lots).ThenInclude(l => l.Bids);

    public async Task<List<LiveEventSummaryDto>> ListAsync(bool includeDrafts, string? status, string? q, CancellationToken ct)
    {
        var query = db.LiveEvents.AsNoTracking().AsQueryable();
        if (!includeDrafts) query = query.Where(e => e.Status != LiveEventStatus.Draft);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<LiveEventStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new ApiException(400, "invalid_status", "Trạng thái sự kiện không hợp lệ.");
            query = query.Where(e => e.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(e => e.Title.Contains(term) || e.Code.Contains(term));
        }
        var rows = await query.OrderByDescending(e => e.ScheduledStartAt).ThenByDescending(e => e.Id)
            .Select(e => new
            {
                Event = e,
                LotCount = e.Lots.Count(),
                SoldCount = e.Lots.Count(l => l.Status == LiveLotStatus.Sold),
                CurrentLotNumber = e.Lots.Where(l => l.Id == e.CurrentLotId).Select(l => l.LotNumber).FirstOrDefault(),
                CurrentLotTitle = e.Lots.Where(l => l.Id == e.CurrentLotId).Select(l => l.Title).FirstOrDefault(),
                CurrentLotImageUrl = e.Lots.Where(l => l.Id == e.CurrentLotId).Select(l => l.ImageUrl).FirstOrDefault(),
                CurrentLotPrice = e.Lots.Where(l => l.Id == e.CurrentLotId).Select(l => (decimal?)l.CurrentPrice).FirstOrDefault()
            }).ToListAsync(ct);
        var viewer = await currentUser.OptionalAsync(ct);
        var eventIds = rows.Select(x => x.Event.Id).ToList();
        var registrations = viewer == null
            ? new Dictionary<int, LiveRegistration>()
            : await db.LiveRegistrations.AsNoTracking()
                .Where(r => r.UserId == viewer.Id && eventIds.Contains(r.EventId))
                .ToDictionaryAsync(r => r.EventId, ct);
        return rows.Select(row =>
        {
            var item = Summary<LiveEventSummaryDto>(row.Event, registrations.GetValueOrDefault(row.Event.Id),
                row.LotCount, row.SoldCount, row.CurrentLotNumber);
            item.CurrentLotTitle = row.CurrentLotTitle;
            item.CurrentLotImageUrl = row.CurrentLotImageUrl;
            item.CurrentLotPrice = row.CurrentLotPrice;
            return item;
        }).ToList();
    }

    public async Task<LiveEventDto> GetAsync(int id, CancellationToken ct)
    {
        var entity = await EventQuery().FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện đấu giá trực tiếp.");
        var viewer = await currentUser.OptionalAsync(ct);
        var registration = viewer == null ? null
            : entity.Registrations.FirstOrDefault(r => r.UserId == viewer.Id);
        var lots = entity.Lots.OrderBy(l => l.SequenceNumber).Select(l => LotDto(l, viewer)).ToList();
        var dto = Summary<LiveEventDto>(entity, registration, lots.Count,
            lots.Count(l => l.Status == nameof(LiveLotStatus.Sold)),
            entity.Lots.FirstOrDefault(l => l.Id == entity.CurrentLotId)?.LotNumber ?? 0);
        dto.Lots = lots;
        dto.RegistrationCount = entity.Registrations.Count(r => r.Status == LiveRegistrationStatus.Approved);
        var currentLot = entity.Lots.FirstOrDefault(l => l.Id == entity.CurrentLotId);
        dto.CurrentLotTitle = currentLot?.Title;
        dto.CurrentLotImageUrl = currentLot?.ImageUrl;
        dto.CurrentLotPrice = currentLot?.CurrentPrice;
        // Khách chưa đăng nhập vẫn xem được sự kiện, nhưng không thấy trạng thái đăng ký.
        return dto;
    }

    public async Task<LiveSnapshotDto> SnapshotAsync(int id, CancellationToken ct)
    {
        var entity = await GetAsync(id, ct);
        if (entity.Status == nameof(LiveEventStatus.Draft))
            throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện đấu giá trực tiếp.");
        var viewer = await currentUser.OptionalAsync(ct);
        var current = entity.Lots.FirstOrDefault(l => l.Id == entity.CurrentLotId);
        var recent = new List<LiveBidDto>();
        if (current != null)
        {
            var rows = await db.LiveBids.AsNoTracking()
                .Where(b => b.LotId == current.Id)
                .OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id).Take(50)
                .Select(b => new { b.Id, b.Amount, b.BidTime, b.UserId, Username = b.User.Username })
                .ToListAsync(ct);
            recent = rows.Select(b => new LiveBidDto
            {
                Id = b.Id, Amount = b.Amount, BidTime = b.BidTime,
                BidderCode = Mask(b.Username), IsMine = viewer != null && b.UserId == viewer.Id
            }).ToList();
        }
        var activity = new List<LiveActivityDto>();
        foreach (var lot in entity.Lots.Where(l => l.ClosedAt != null).OrderByDescending(l => l.ClosedAt).Take(12))
        {
            activity.Add(new LiveActivityDto
            {
                Key = $"lot-{lot.Id}-closed",
                Type = lot.Status == nameof(LiveLotStatus.Sold) ? "sold" : "unsold",
                At = lot.ClosedAt!.Value,
                Text = lot.Status == nameof(LiveLotStatus.Sold)
                    ? $"Đã bán lô {lot.LotNumber:000} · {lot.Title}"
                    : $"Lô {lot.LotNumber:000} không bán được · {lot.Title}",
                Amount = lot.HammerPrice
            });
        }
        if (current != null)
        {
            if (current.OpenedAt is DateTime opened)
                activity.Add(new LiveActivityDto
                {
                    Key = $"lot-{current.Id}-open", Type = "open", At = opened,
                    Text = $"Mở lô {current.LotNumber:000} · giá khởi điểm {current.StartingPrice:N0} ₫"
                });
            if (current.Status == nameof(LiveLotStatus.Open) && current.CallingStage != nameof(LiveCallingStage.None))
                activity.Add(new LiveActivityDto
                {
                    Key = $"lot-{current.Id}-warning", Type = "warning",
                    At = current.OpenedAt ?? DateTime.UtcNow,
                    Text = current.CallingStage == nameof(LiveCallingStage.Twice)
                        ? "Người điều hành đã cảnh báo chốt lần 2"
                        : "Người điều hành đã cảnh báo chốt lần 1"
                });
            foreach (var bid in recent)
                activity.Add(new LiveActivityDto
                {
                    Key = $"bid-{bid.Id}", Type = "bid", At = bid.BidTime,
                    Text = $"{bid.BidderCode} đặt giá", Amount = bid.Amount
                });
        }
        activity.Sort((a, b) => b.At.CompareTo(a.At));
        return new LiveSnapshotDto
        {
            Event = entity,
            ServerTime = DateTime.UtcNow,
            MyRegistrationStatus = entity.MyRegistrationStatus,
            // Chỉ đăng ký đã duyệt mới được trả giá; khách chưa đăng nhập luôn false.
            CanBid = viewer != null && entity.MyRegistrationStatus == nameof(LiveRegistrationStatus.Approved)
                    && (entity.Status == nameof(LiveEventStatus.Live) || entity.Status == nameof(LiveEventStatus.Paused)),
            Activity = activity.Take(50).ToList(),
            RecentBids = recent
        };
    }

    public async Task<string> RegisterAsync(int eventId, CancellationToken ct)
    {
        var user = await currentUser.RequireMemberAsync(ct);
        var ev = await db.LiveEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện đấu giá trực tiếp.");
        if (!ev.RegistrationOpen || ev.Status is LiveEventStatus.Draft or LiveEventStatus.Completed or LiveEventStatus.Cancelled)
            throw new ApiException(409, "registration_closed", "Sự kiện không mở đăng ký tham gia.");
        var registration = await db.LiveRegistrations
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == user.Id, ct);
        if (registration is null)
        {
            registration = new LiveRegistration
            {
                EventId = eventId, UserId = user.Id,
                Status = LiveRegistrationStatus.Approved, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            db.LiveRegistrations.Add(registration);
            db.Notifications.Add(new Notification
            {
                UserId = user.Id,
                Title = "Đã đăng ký đấu giá trực tiếp",
                Message = $"Bạn đã đăng ký tham gia sự kiện '{ev.Title}'. Có thể đặt giá khi lô của bạn được mở.",
                CreatedAt = DateTime.UtcNow
            });
        }
        else if (registration.Status is LiveRegistrationStatus.Rejected or LiveRegistrationStatus.Suspended)
            throw new ApiException(403, "registration_blocked", "Đăng ký tham gia của bạn đang bị từ chối hoặc tạm đình chỉ.");
        else if (registration.Status == LiveRegistrationStatus.Withdrawn)
        {
            registration.Status = LiveRegistrationStatus.Approved;
            registration.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return registration.Status.ToString();
    }

    public async Task<LiveBidDto> PlaceBidAsync(int lotId, decimal amount, CancellationToken ct)
    {
        var user = await currentUser.RequireMemberAsync(ct);
        var lot = await db.LiveLots.Include(l => l.Event).Include(l => l.Product)
            .FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô đấu giá.");
        if (lot.Event.CurrentLotId != lot.Id || lot.Status != LiveLotStatus.Open ||
            lot.Event.Status != LiveEventStatus.Live)
            throw new ApiException(409, "lot_not_open", "Lô này chưa mở hoặc đã kết thúc.");
        if (lot.SellerId == user.Id)
            throw new ApiException(403, "seller_cannot_bid", "Bạn không thể đặt giá cho sản phẩm của chính mình.");
        var registration = await db.LiveRegistrations.AsNoTracking()
            .FirstOrDefaultAsync(r => r.EventId == lot.EventId && r.UserId == user.Id, ct);
        if (registration?.Status != LiveRegistrationStatus.Approved)
            throw new ApiException(403, "registration_required", "Vui lòng đăng ký tham gia sự kiện trước khi đặt giá.");

        if (amount <= 0 || amount != decimal.Truncate(amount) || amount > 100_000_000_000m)
            throw new ApiException(400, "invalid_bid", "Giá đặt phải là số nguyên VND dương.");
        var minimum = lot.BidCount == 0 ? lot.StartingPrice : lot.CurrentPrice + lot.BidIncrement;
        if (amount < minimum)
            throw new ApiException(400, "bid_too_low", $"Giá tối thiểu hiện tại là {minimum:N0} VND.");
        if (lot.BidIncrement > 0 && (amount - minimum) % lot.BidIncrement != 0)
            throw new ApiException(400, "bid_increment", $"Giá đặt phải tăng theo bước giá {lot.BidIncrement:N0} VND.");
        if (lot.BidCount > 0 && lot.LeadingBidderId == user.Id)
            throw new ApiException(409, "already_leading", "Bạn đang dẫn đầu lô này, không cần đặt giá thêm.");

        var previousLeaderId = lot.LeadingBidderId;
        var now = DateTime.UtcNow;
        var bid = new LiveBid { LotId = lot.Id, UserId = user.Id, Amount = amount, BidTime = now };
        db.LiveBids.Add(bid);
        lot.LeadingBidderId = user.Id;
        lot.CurrentPrice = amount;
        lot.BidCount += 1;
        // Lượt giá mới đặt lại giai đoạn gọi giá theo quy tắc công bố.
        lot.CallingStage = LiveCallingStage.None;
        lot.LastWarningAt = null;

        if (previousLeaderId is int previousId && previousId != user.Id)
        {
            db.Notifications.Add(new Notification
            {
                UserId = previousId,
                ProductId = lot.ProductId,
                Title = "Bạn đã bị vượt giá",
                Message = $"Lô {lot.LotNumber:000} · '{lot.Title}' vừa có mức giá {amount:N0} VNĐ cao hơn.",
                CreatedAt = now
            });
        }
        db.Notifications.Add(new Notification
        {
            UserId = lot.SellerId,
            ProductId = lot.ProductId,
            Title = "Lượt đặt giá trực tiếp",
            Message = $"Lô {lot.LotNumber:000} · '{lot.Title}' vừa có lượt đặt giá {amount:N0} VNĐ.",
            CreatedAt = now
        });

        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "bid_conflict", "Giá đã thay đổi. Vui lòng kiểm tra và đặt lại.");
        }

        var dto = new LiveBidDto
        {
            Id = bid.Id, Amount = amount, BidTime = now,
            BidderCode = Mask(user.Username), IsMine = true
        };
        await Broadcast(lot.EventId, "BidAccepted", new
        {
            eventId = lot.EventId, lotId = lot.Id, currentPrice = amount,
            nextBid = amount + lot.BidIncrement, bidCount = lot.BidCount,
            leadingBidderCode = Mask(user.Username),
            bid = new { amount, bidderCode = Mask(user.Username), at = now },
            serverTime = now
        }, ct);
        return dto;
    }

    public async Task<LiveEventDto> GetPublicAsync(int id, CancellationToken ct)
    {
        var entity = await GetAsync(id, ct);
        if (entity.Status == nameof(LiveEventStatus.Draft))
            throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện đấu giá trực tiếp.");
        return entity;
    }

    public async Task<List<LiveBidDto>> RecentBidsAsync(int lotId, CancellationToken ct)
    {
        var viewer = await currentUser.OptionalAsync(ct);
        var rows = await db.LiveBids.AsNoTracking().Where(b => b.LotId == lotId)
            .OrderByDescending(b => b.BidTime).ThenByDescending(b => b.Id).Take(50)
            .Select(b => new { b.Id, b.Amount, b.BidTime, b.UserId, Username = b.User.Username })
            .ToListAsync(ct);
        return rows.Select(b => new LiveBidDto
        {
            Id = b.Id, Amount = b.Amount, BidTime = b.BidTime,
            BidderCode = Mask(b.Username), IsMine = viewer != null && b.UserId == viewer.Id
        }).ToList();
    }

    // ── Quản trị ──────────────────────────────────────────────────────────────
    public async Task<LiveEventDto> CreateAsync(CreateLiveEventDto request, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        ValidateEvent(request);
        var entity = new LiveEvent
        {
            Code = "LIVE-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant(),
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            BannerUrl = request.BannerUrl,
            ScheduledStartAt = request.ScheduledStartAt,
            ScheduledEndAt = request.ScheduledEndAt,
            RegistrationOpen = request.RegistrationOpen,
            BuyerPremiumRate = request.BuyerPremiumRate,
            CreatedById = admin.Id,
            Status = LiveEventStatus.Draft
        };
        db.LiveEvents.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<LiveEventDto> UpdateAsync(int id, UpdateLiveEventDto request, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        ValidateEvent(request);
        var entity = await db.LiveEvents.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        if (entity.Status is LiveEventStatus.Live or LiveEventStatus.Paused or LiveEventStatus.Completed or LiveEventStatus.Cancelled)
            throw new ApiException(409, "event_locked", "Chỉ có thể sửa sự kiện chưa bắt đầu.");
        entity.Title = request.Title.Trim();
        entity.Description = request.Description?.Trim();
        entity.BannerUrl = request.BannerUrl;
        entity.ScheduledStartAt = request.ScheduledStartAt;
        entity.ScheduledEndAt = request.ScheduledEndAt;
        entity.RegistrationOpen = request.RegistrationOpen;
        entity.BuyerPremiumRate = request.BuyerPremiumRate;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<LiveEventDto> PublishAsync(int id, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var entity = await db.LiveEvents.Include(e => e.Lots)
            .FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        if (entity.Status != LiveEventStatus.Draft)
            throw new ApiException(409, "invalid_status", "Chỉ công bố được sự kiện ở trạng thái nháp.");
        if (entity.Lots.Count == 0)
            throw new ApiException(400, "event_empty", "Hãy thêm ít nhất một lô trước khi công bố.");
        if (entity.ScheduledStartAt <= DateTime.UtcNow)
            throw new ApiException(400, "invalid_schedule", "Thời gian bắt đầu phải ở trong tương lai mới có thể công bố.");
        if (entity.ScheduledEndAt is DateTime end && end <= entity.ScheduledStartAt)
            throw new ApiException(400, "invalid_schedule", "Thời gian kết thúc phải sau thời gian bắt đầu.");
        entity.Status = LiveEventStatus.Published;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await BroadcastCatalogChanged(id, "Published", ct);
        return await GetAsync(id, ct);
    }

    public async Task<LiveLotDto> AddLotAsync(int eventId, AddLiveLotDto request, CancellationToken ct)
    {
        var admin = await currentUser.RequireAdminAsync(ct);
        var entity = await db.LiveEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        if (entity.Status is not (LiveEventStatus.Draft or LiveEventStatus.Published))
            throw new ApiException(409, "event_locked", "Chỉ sự kiện nháp hoặc đã công bố mới nhận thêm lô.");

        var liveRequest = await db.LiveAuctionRequests
            .Include(r => r.Product).ThenInclude(p => p.Seller)
            .FirstOrDefaultAsync(r => r.Id == request.LiveAuctionRequestId, ct)
            ?? throw new ApiException(404, "request_not_found", "Không tìm thấy yêu cầu đấu giá trực tiếp.");
        var product = liveRequest.Product;
        if (liveRequest.Status != LiveAuctionRequestStatus.Approved ||
            liveRequest.SellerConfirmedAt == null ||
            liveRequest.AcceptedTermsVersion != liveRequest.TermsVersion)
            throw new ApiException(409, "request_not_approved", "Yêu cầu chưa được duyệt hoặc người bán chưa xác nhận điều kiện.");
        if (product.SellerId != liveRequest.SellerId || product.AuctionType != ProductAuctionType.Live ||
            product.Seller.Role != "User" ||
            product.Status is not (ProductStatus.Scheduled or ProductStatus.Draft or ProductStatus.Cancelled) ||
            await db.Bids.AnyAsync(b => b.ProductId == product.Id, ct) ||
            await db.Orders.AnyAsync(o => o.ProductId == product.Id, ct))
            throw new ApiException(409, "product_unavailable", "Sản phẩm không còn đủ điều kiện đấu giá trực tiếp.");
        var inActiveLot = await db.LiveLots.AnyAsync(l => l.ProductId == product.Id &&
            l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped && l.Status != LiveLotStatus.Withdrawn, ct);
        if (inActiveLot)
            throw new ApiException(409, "product_in_live", "Sản phẩm đã thuộc một lô đấu giá trực tiếp khác.");

        var starting = liveRequest.ProposedStartingPrice;
        if (starting < 1000 || starting != decimal.Truncate(starting) || starting > 100_000_000_000m)
            throw new ApiException(400, "invalid_price", "Giá khởi điểm phải là số nguyên VND từ 1.000.");
        var increment = liveRequest.ProposedBidIncrement;
        if (increment < 1 || increment != decimal.Truncate(increment))
            throw new ApiException(400, "invalid_increment", "Bước giá phải là số nguyên VND dương.");
        if (liveRequest.ProposedReservePrice is decimal reserve &&
            (reserve < starting || reserve != decimal.Truncate(reserve)))
            throw new ApiException(400, "invalid_reserve", "Giá dự trữ phải là số nguyên và không thấp hơn giá khởi điểm.");

        var sequence = (await db.LiveLots.Where(l => l.EventId == eventId)
            .Select(l => (int?)l.SequenceNumber).MaxAsync(ct) ?? 0) + 1;
        var image = await db.ProductImages.AsNoTracking().Where(i => i.ProductId == product.Id)
            .OrderBy(i => i.Id).Select(i => i.CloudinaryUrl).FirstOrDefaultAsync(ct) ?? product.ImageUrl;
        var lot = new LiveLot
        {
            EventId = eventId,
            ProductId = product.Id,
            LiveAuctionRequestId = liveRequest.Id,
            AddedById = admin.Id,
            SellerId = product.SellerId,
            SequenceNumber = sequence,
            LotNumber = sequence,
            Title = product.Name,
            Description = product.Description,
            ImageUrl = image,
            StartingPrice = starting,
            CurrentPrice = starting,
            ReservePrice = liveRequest.ProposedReservePrice,
            BidIncrement = increment,
            Status = LiveLotStatus.Pending
        };
        liveRequest.Status = LiveAuctionRequestStatus.Scheduled;
        liveRequest.ScheduledEventId = eventId;
        liveRequest.UpdatedAt = DateTime.UtcNow;
        db.LiveLots.Add(lot);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "request_changed", "Yêu cầu vừa thay đổi. Hãy tải lại kho trước khi xếp lô.");
        }
        catch (DbUpdateException)
        {
            throw new ApiException(409, "lot_conflict", "Không thể thêm lô; sản phẩm hoặc yêu cầu có thể vừa được xếp vào sự kiện khác.");
        }
        await Broadcast(eventId, "LotsChanged", new { eventId }, ct);
        return LotDto(await db.LiveLots.AsNoTracking().Include(l => l.Seller).Include(l => l.Bids)
            .Include(l => l.LiveAuctionRequest)
            .FirstAsync(l => l.Id == lot.Id, ct), null);
    }

    public async Task RemoveLotAsync(int lotId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var lot = await db.LiveLots.Include(l => l.LiveAuctionRequest).FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô.");
        if (lot.Status is not (LiveLotStatus.Pending or LiveLotStatus.Skipped or LiveLotStatus.Withdrawn))
            throw new ApiException(409, "lot_started", "Chỉ xóa được lô chưa mở đấu giá.");
        if (lot.LiveAuctionRequest is not null)
        {
            lot.LiveAuctionRequest.Status = LiveAuctionRequestStatus.Approved;
            lot.LiveAuctionRequest.ScheduledEventId = null;
            lot.LiveAuctionRequest.UpdatedAt = DateTime.UtcNow;
        }
        db.LiveLots.Remove(lot);
        await db.SaveChangesAsync(ct);
        await Broadcast(lot.EventId, "LotsChanged", new { eventId = lot.EventId }, ct);
    }

    public async Task<LiveSnapshotDto> StartLotAsync(int lotId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var lot = await db.LiveLots.Include(l => l.Event).Include(l => l.LiveAuctionRequest)
            .FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô.");
        var entity = lot.Event;
        if (entity.Status is LiveEventStatus.Draft or LiveEventStatus.Completed or LiveEventStatus.Cancelled or LiveEventStatus.Paused)
            throw new ApiException(409, "event_not_ready", "Sự kiện chưa sẵn sàng để mở lô.");
        if (lot.Status != LiveLotStatus.Pending)
            throw new ApiException(409, "invalid_lot_status", "Lô này không ở trạng thái chờ mở.");
        if (await db.LiveLots.AnyAsync(l => l.EventId == entity.Id && l.Status == LiveLotStatus.Open, ct))
            throw new ApiException(409, "lot_already_open", "Hãy chốt lô đang mở trước khi mở lô khác.");
        var now = DateTime.UtcNow;
        lot.Status = LiveLotStatus.Open;
        lot.CurrentPrice = lot.StartingPrice;
        lot.OpenedAt = now;
        lot.CallingStage = LiveCallingStage.None;
        lot.LastWarningAt = null;
        if (lot.LiveAuctionRequest is not null)
        {
            lot.LiveAuctionRequest.Status = LiveAuctionRequestStatus.Live;
            lot.LiveAuctionRequest.UpdatedAt = now;
        }
        entity.Status = LiveEventStatus.Live;
        entity.StartedAt ??= now;
        entity.CurrentLotId = lot.Id;
        entity.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        await Broadcast(entity.Id, "LotOpened", new
        {
            eventId = entity.Id, lotId = lot.Id, lotNumber = lot.LotNumber,
            lot = new { lot.Title, lot.StartingPrice, lot.CurrentPrice, lot.BidIncrement },
            serverTime = now
        }, ct);
        return await SnapshotAsync(entity.Id, ct);
    }

    public async Task<LiveSnapshotDto> WarnAsync(int lotId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var lot = await db.LiveLots.Include(l => l.Event).Include(l => l.LiveAuctionRequest)
            .FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô.");
        if (lot.Status != LiveLotStatus.Open || lot.Event.Status != LiveEventStatus.Live ||
            lot.Event.CurrentLotId != lot.Id)
            throw new ApiException(409, "lot_not_open", "Chỉ cảnh báo lô hiện tại của sự kiện đang diễn ra.");

        var now = DateTime.UtcNow;
        LiveCallingStage stage;
        if (lot.CallingStage == LiveCallingStage.None)
        {
            stage = LiveCallingStage.Once;
        }
        else if (lot.CallingStage == LiveCallingStage.Once)
        {
            var lastWarningAt = lot.LastWarningAt ?? now;
            var availableAt = lastWarningAt.AddSeconds(WarningIntervalSeconds);
            if (availableAt > now)
            {
                if (lot.LastWarningAt is null)
                {
                    lot.LastWarningAt = now;
                    try { await db.SaveChangesAsync(ct); }
                    catch (DbUpdateConcurrencyException)
                    {
                        throw new ApiException(409, "lot_conflict", "Lô vừa thay đổi. Vui lòng tải lại trước khi cảnh báo.");
                    }
                }
                var secondsRemaining = Math.Ceiling((availableAt - now).TotalSeconds);
                throw new ApiException(409, "warning_interval",
                    $"Vui lòng chờ {secondsRemaining:N0} giây trước khi gửi cảnh báo lần 2.");
            }
            stage = LiveCallingStage.Twice;
        }
        else
        {
            throw new ApiException(409, "warning_complete", "Lô đã nhận đủ hai cảnh báo chốt.");
        }

        lot.CallingStage = stage;
        lot.LastWarningAt = now;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "lot_conflict", "Lô vừa thay đổi. Vui lòng tải lại trước khi cảnh báo.");
        }
        await Broadcast(lot.EventId, "FairWarning", new
        {
            eventId = lot.EventId, lotId = lot.Id,
            stage = stage.ToString(), call = (int)stage, serverTime = now
        }, ct);
        return await SnapshotAsync(lot.EventId, ct);
    }

    public async Task<LiveSnapshotDto> CloseLotAsync(int lotId, bool forceUnsold, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var lot = await db.LiveLots.Include(l => l.Event).FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô.");
        if (lot.Status != LiveLotStatus.Open)
            throw new ApiException(409, "lot_not_open", "Lô này chưa mở hoặc đã chốt.");
        if (lot.Event.Status != LiveEventStatus.Live || lot.Event.CurrentLotId != lot.Id)
            throw new ApiException(409, "event_not_live", "Chỉ có thể chốt lô hiện tại của sự kiện đang diễn ra.");

        var now = DateTime.UtcNow;
        var winning = await db.LiveBids.AsNoTracking()
            .Where(b => b.LotId == lot.Id)
            .OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
            .FirstOrDefaultAsync(ct);
        var meetsReserve = winning != null && (lot.ReservePrice is null || winning.Amount >= lot.ReservePrice.Value);
        if (forceUnsold && meetsReserve)
            throw new ApiException(409, "unsold_not_allowed",
                "Không thể đánh dấu không bán được khi đã có giá hợp lệ đạt giá dự trữ. Hãy tạm dừng và xử lý sự cố.");
        if (!forceUnsold && meetsReserve && lot.CallingStage != LiveCallingStage.Twice)
            throw new ApiException(409, "warning_required",
                "Cần gửi đủ hai cảnh báo chốt trước khi xác nhận bán.");

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == lot.ProductId, ct);
        lot.ClosedAt = now;
        lot.CallingStage = LiveCallingStage.None;
        lot.LastWarningAt = null;
        lot.Event.CurrentLotId = null;
        lot.Event.UpdatedAt = now;
        if (lot.LiveAuctionRequest is not null)
        {
            lot.LiveAuctionRequest.Status = LiveAuctionRequestStatus.Completed;
            lot.LiveAuctionRequest.UpdatedAt = now;
        }

        if (meetsReserve && winning != null)
        {
            lot.Status = LiveLotStatus.Sold;
            lot.WinnerId = winning.UserId;
            lot.HammerPrice = winning.Amount;
            if (product != null)
            {
                product.Status = ProductStatus.Completed;
                product.WinnerId = winning.UserId;
                // Product có ràng buộc CurrentPrice >= StartingPrice; lô live được
                // phép khởi điểm thấp hơn nên giữ mức sàn để không vi phạm constraint.
                product.CurrentPrice = Math.Max(winning.Amount, product.StartingPrice);
                product.UpdatedAt = now;
            }
            var order = await db.Orders.FirstOrDefaultAsync(o => o.ProductId == lot.ProductId, ct);
            if (order is null)
            {
                order = new Order
                {
                    ProductId = lot.ProductId,
                    BuyerId = winning.UserId,
                    SellerId = lot.SellerId,
                    FinalPrice = winning.Amount,
                    ProductNameSnapshot = lot.Title,
                    Status = OrderStatus.Pending,
                    CreatedAt = now
                };
                order.Events.Add(new OrderEvent
                {
                    Action = "Created", ToStatus = OrderStatus.Pending,
                    Note = $"Tạo đơn từ lô {lot.LotNumber:000} của sự kiện {lot.Event.Code}.",
                    CreatedAt = now
                });
                db.Orders.Add(order);
            }
            else
            {
                order.BuyerId = winning.UserId;
                order.FinalPrice = winning.Amount;
            }
            db.Notifications.Add(new Notification
            {
                UserId = winning.UserId,
                ProductId = lot.ProductId,
                Order = order,
                Title = "Chúc mừng bạn đã thắng lô đấu giá!",
                Message = $"Bạn thắng lô {lot.LotNumber:000} · '{lot.Title}' với giá {winning.Amount:N0} VNĐ. Vui lòng cập nhật địa chỉ nhận hàng.",
                CreatedAt = now
            });
            db.Notifications.Add(new Notification
            {
                UserId = lot.SellerId,
                ProductId = lot.ProductId,
                Order = order,
                Title = "Lô đấu giá đã bán",
                Message = $"Lô {lot.LotNumber:000} · '{lot.Title}' đã bán với giá {winning.Amount:N0} VNĐ.",
                CreatedAt = now
            });
        }
        else
        {
            lot.Status = LiveLotStatus.Unsold;
            // Sản phẩm chưa bán được vẫn ở Scheduled để người bán có thể gửi lại.
            db.Notifications.Add(new Notification
            {
                UserId = lot.SellerId,
                ProductId = lot.ProductId,
                Title = "Lô không bán được",
                Message = winning is null
                    ? $"Lô {lot.LotNumber:000} · '{lot.Title}' kết thúc mà không có lượt đặt giá."
                    : $"Lô {lot.LotNumber:000} · '{lot.Title}' chưa đạt giá dự trữ nên không bán được.",
                CreatedAt = now
            });
        }

        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "lot_conflict", "Lô vừa thay đổi, hãy tải lại trước khi chốt.");
        }

        await Broadcast(lot.EventId, meetsReserve ? "LotSold" : "LotUnsold", new
        {
            eventId = lot.EventId, lotId = lot.Id, lotNumber = lot.LotNumber,
            status = lot.Status.ToString(),
            winnerId = lot.WinnerId,
            winnerName = meetsReserve ? Mask(await db.Users.Where(u => u.Id == lot.WinnerId).Select(u => u.Username).FirstOrDefaultAsync(ct)) : null,
            hammerPrice = lot.HammerPrice,
            serverTime = now
        }, ct);
        return await SnapshotAsync(lot.EventId, ct);
    }

    public async Task SkipLotAsync(int lotId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var lot = await db.LiveLots.Include(l => l.LiveAuctionRequest).FirstOrDefaultAsync(l => l.Id == lotId, ct)
            ?? throw new ApiException(404, "lot_not_found", "Không tìm thấy lô.");
        if (lot.Status != LiveLotStatus.Pending)
            throw new ApiException(409, "invalid_lot_status", "Chỉ bỏ qua được lô chưa mở.");
        lot.Status = LiveLotStatus.Skipped;
        if (lot.LiveAuctionRequest is not null)
        {
            lot.LiveAuctionRequest.Status = LiveAuctionRequestStatus.Approved;
            lot.LiveAuctionRequest.ScheduledEventId = null;
            lot.LiveAuctionRequest.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        await Broadcast(lot.EventId, "LotsChanged", new { eventId = lot.EventId }, ct);
    }

    public async Task<LiveSnapshotDto> PauseAsync(int eventId, bool resume, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var entity = await db.LiveEvents.FirstOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        if (resume)
        {
            if (entity.Status != LiveEventStatus.Paused)
                throw new ApiException(409, "invalid_status", "Sự kiện không ở trạng thái tạm dừng.");
            entity.Status = LiveEventStatus.Live;
        }
        else
        {
            if (entity.Status != LiveEventStatus.Live)
                throw new ApiException(409, "invalid_status", "Chỉ tạm dừng được sự kiện đang diễn ra.");
            entity.Status = LiveEventStatus.Paused;
        }
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await Broadcast(eventId, resume ? "EventResumed" : "EventPaused", new
        {
            eventId, status = entity.Status.ToString(), serverTime = DateTime.UtcNow
        }, ct);
        return await SnapshotAsync(eventId, ct);
    }

    public async Task<LiveSnapshotDto> CompleteAsync(int eventId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var entity = await db.LiveEvents.Include(e => e.Lots)
            .FirstOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        if (entity.Status is LiveEventStatus.Completed or LiveEventStatus.Cancelled)
            throw new ApiException(409, "invalid_status", "Sự kiện đã kết thúc.");
        if (entity.Lots.Any(l => l.Status is not (
            LiveLotStatus.Sold or LiveLotStatus.Unsold or LiveLotStatus.Skipped or LiveLotStatus.Withdrawn)))
            throw new ApiException(409, "lots_pending", "Hãy xử lý tất cả các lô trước khi kết thúc sự kiện.");
        entity.Status = LiveEventStatus.Completed;
        entity.EndedAt = DateTime.UtcNow;
        entity.CurrentLotId = null;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await Broadcast(eventId, "EventCompleted", new
        {
            eventId, status = entity.Status.ToString(), serverTime = DateTime.UtcNow
        }, ct);
        return await SnapshotAsync(eventId, ct);
    }

    public async Task AnnounceAsync(int eventId, string message, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        if (string.IsNullOrWhiteSpace(message))
            throw new ApiException(400, "invalid_message", "Nội dung thông báo không được trống.");
        if (!await db.LiveEvents.AnyAsync(e => e.Id == eventId, ct))
            throw new ApiException(404, "event_not_found", "Không tìm thấy sự kiện.");
        await Broadcast(eventId, "Announcement", new
        {
            eventId, message = message.Trim(), at = DateTime.UtcNow
        }, ct);
    }

    public async Task<List<LiveRegistrationDto>> RegistrationsAsync(int eventId, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        return await db.LiveRegistrations.AsNoTracking().Where(r => r.EventId == eventId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new LiveRegistrationDto
            {
                Id = r.Id, UserId = r.UserId, Username = r.User.Username,
                FullName = r.User.FullName, Status = r.Status.ToString(), CreatedAt = r.CreatedAt
            }).ToListAsync(ct);
    }

    private async Task Broadcast(int eventId, string method, object payload, CancellationToken ct)
    {
        try
        {
            await hub.Clients.Group(LiveAuctionHub.GroupName(eventId)).SendAsync(method, payload, ct);
        }
        catch (Exception ex)
        {
            // Realtime chỉ là kênh phụ; dữ liệu đã lưu trong DB vẫn là nguồn đúng.
            logger.LogWarning(ex, "Không gửi được {Method} cho sự kiện live {EventId}", method, eventId);
        }

        if (method is "BidAccepted" or "LotOpened" or "LotSold" or "LotUnsold" or
            "EventPaused" or "EventResumed" or "EventCompleted" or "LotsChanged")
            await BroadcastCatalogChanged(eventId, method, ct);
    }

    private async Task BroadcastCatalogChanged(int eventId, string change, CancellationToken ct)
    {
        try
        {
            await hub.Clients.Group(LiveAuctionHub.LobbyGroupName)
                .SendAsync("LiveCatalogChanged", new { eventId, change }, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Không gửi được thay đổi danh mục live {Change} cho sự kiện {EventId}", change, eventId);
        }
    }

    private static void ValidateEvent(CreateLiveEventDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ApiException(400, "invalid_title", "Tên sự kiện không được trống.");
        if (request.ScheduledStartAt.Kind != DateTimeKind.Utc)
            throw new ApiException(400, "invalid_time", "Thời gian bắt đầu phải là UTC.");
        if (request.ScheduledEndAt is DateTime end && end <= request.ScheduledStartAt)
            throw new ApiException(400, "invalid_time", "Thời gian kết thúc phải sau thời gian bắt đầu.");
        if (request.BuyerPremiumRate is < 0 or > 0.5m)
            throw new ApiException(400, "invalid_premium", "Phí người mua phải từ 0% đến 50%.");
        if (!string.IsNullOrWhiteSpace(request.BannerUrl) &&
            (!Uri.TryCreate(request.BannerUrl, UriKind.Absolute, out var uri) ||
             (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
            throw new ApiException(400, "invalid_image_url", "URL banner phải dùng HTTP hoặc HTTPS.");
    }
}
