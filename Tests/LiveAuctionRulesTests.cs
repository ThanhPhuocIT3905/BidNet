using System.Security.Claims;
using BidNet.Data;
using BidNet.DTOs;
using BidNet.Hubs;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace BidNet.Tests;

public class LiveAuctionRulesTests
{
    private static AppDbContext NewDatabase() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static CurrentUser Admin(AppDbContext db)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "1")], "Test"));
        return new CurrentUser(new HttpContextAccessor { HttpContext = context }, db);
    }

    private static CurrentUser CurrentUserFor(AppDbContext db, int id)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, id.ToString())], "Test"));
        return new CurrentUser(new HttpContextAccessor { HttpContext = context }, db);
    }

    private static IConfiguration Settings() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LiveAuction:MinWarningIntervalSeconds"] = "5"
        }).Build();

    private static IHubContext<LiveAuctionHub> Hub()
    {
        var hub = new Mock<IHubContext<LiveAuctionHub>>();
        var clients = new Mock<IHubClients>();
        var client = new Mock<IClientProxy>();
        client.Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(),
            It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(client.Object);
        hub.SetupGet(h => h.Clients).Returns(clients.Object);
        return hub.Object;
    }

    private static LiveAuctionService Service(AppDbContext db) =>
        new(db, Admin(db), Settings(), Hub(), NullLogger<LiveAuctionService>.Instance);

    private static LiveAuctionService Service(AppDbContext db, CurrentUser currentUser) =>
        new(db, currentUser, Settings(), Hub(), NullLogger<LiveAuctionService>.Instance);

    private static async Task SeedEvent(AppDbContext db, LiveLotStatus lotStatus = LiveLotStatus.Open,
        bool withSaleableBid = false, int? currentLotId = 20,
        LiveEventStatus eventStatus = LiveEventStatus.Live)
    {
        var admin = new User { Id = 1, Username = "admin", Email = "admin@example.com", Role = "Admin" };
        var seller = new User { Id = 2, Username = "seller", Email = "seller@example.com" };
        var bidder = new User { Id = 3, Username = "bidder", Email = "bidder@example.com" };
        var product = new Product
        {
            Id = 30, Name = "Camera", SellerId = seller.Id, Seller = seller,
            StartingPrice = 1000, CurrentPrice = 1000, Status = ProductStatus.Active
        };
        var liveEvent = new LiveEvent
        {
            Id = 10, Code = "LIVE-10", Title = "Test event", CreatedById = admin.Id,
            CreatedBy = admin, Status = eventStatus, CurrentLotId = currentLotId,
            AllowLateLotAddition = true
        };
        var lot = new LiveLot
        {
            Id = 20, EventId = liveEvent.Id, Event = liveEvent, ProductId = product.Id, Product = product,
            SellerId = seller.Id, Seller = seller, SequenceNumber = 1, LotNumber = 1, Title = "Camera",
            StartingPrice = 1000, CurrentPrice = 1000, ReservePrice = 1000, BidIncrement = 100,
            Status = lotStatus, CallingStage = LiveCallingStage.None
        };
        liveEvent.Lots.Add(lot);
        db.Users.AddRange(admin, seller, bidder);
        db.Products.Add(product);
        db.LiveEvents.Add(liveEvent);
        db.LiveLots.Add(lot);
        if (withSaleableBid)
        {
            db.LiveBids.Add(new LiveBid
            {
                Id = 40, LotId = lot.Id, Lot = lot, UserId = bidder.Id, User = bidder,
                Amount = 1000, BidTime = DateTime.UtcNow
            });
            lot.LeadingBidderId = bidder.Id;
            lot.LeadingBidder = bidder;
            lot.BidCount = 1;
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Warn_RequiresFiveSecondsBetweenFirstAndSecondCall()
    {
        await using var db = NewDatabase();
        await SeedEvent(db);
        var service = Service(db);

        await service.WarnAsync(20, CancellationToken.None);
        var tooSoon = await Assert.ThrowsAsync<ApiException>(() => service.WarnAsync(20, CancellationToken.None));

        Assert.Equal("warning_interval", tooSoon.Code);
        Assert.Equal(LiveCallingStage.Once, (await db.LiveLots.SingleAsync()).CallingStage);
        var lot = await db.LiveLots.SingleAsync();
        lot.LastWarningAt = DateTime.UtcNow.AddSeconds(-6);
        await db.SaveChangesAsync();

        await service.WarnAsync(20, CancellationToken.None);
        Assert.Equal(LiveCallingStage.Twice, (await db.LiveLots.SingleAsync()).CallingStage);
    }

    [Fact]
    public async Task Warn_RejectsLotThatIsNotTheEventsCurrentLot()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, currentLotId: 99);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            Service(db).WarnAsync(20, CancellationToken.None));

        Assert.Equal("lot_not_open", error.Code);
    }

    [Fact]
    public async Task Close_RequiresTwoWarningsAndCannotForceUnsoldWhenReserveIsMet()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, withSaleableBid: true);
        var service = Service(db);

        var earlyClose = await Assert.ThrowsAsync<ApiException>(() =>
            service.CloseLotAsync(20, false, CancellationToken.None));
        var forcedUnsold = await Assert.ThrowsAsync<ApiException>(() =>
            service.CloseLotAsync(20, true, CancellationToken.None));

        Assert.Equal("warning_required", earlyClose.Code);
        Assert.Equal("unsold_not_allowed", forcedUnsold.Code);
        Assert.Equal(LiveLotStatus.Open, (await db.LiveLots.SingleAsync()).Status);
    }

    [Fact]
    public async Task Complete_RejectsEventsWithPendingLots()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, lotStatus: LiveLotStatus.Pending, currentLotId: null);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            Service(db).CompleteAsync(10, CancellationToken.None));

        Assert.Equal("lots_pending", error.Code);
        Assert.Equal(LiveEventStatus.Live, (await db.LiveEvents.SingleAsync()).Status);
    }

    [Theory]
    [InlineData(LiveEventStatus.Live)]
    [InlineData(LiveEventStatus.Paused)]
    public async Task AddLot_AppendsApprovedProductWithoutChangingCurrentLot(LiveEventStatus eventStatus)
    {
        await using var db = NewDatabase();
        await SeedEvent(db, eventStatus: eventStatus);

        var seller = new User
        {
            Id = 4,
            Username = "live-seller",
            Email = "live-seller@example.com",
            Role = "User"
        };
        var product = new Product
        {
            Id = 31,
            Name = "Vintage watch",
            Seller = seller,
            SellerId = seller.Id,
            StartingPrice = 5_000,
            CurrentPrice = 5_000,
            StartTime = DateTime.UtcNow.AddDays(1),
            EndTime = DateTime.UtcNow.AddDays(2),
            Status = ProductStatus.Scheduled,
            AuctionType = ProductAuctionType.Live
        };
        var request = new LiveAuctionRequest
        {
            Id = 50,
            RequestCode = "LVR-50",
            Product = product,
            ProductId = product.Id,
            Seller = seller,
            SellerId = seller.Id,
            Status = LiveAuctionRequestStatus.Approved,
            ProposedStartingPrice = 5_000,
            ProposedBidIncrement = 1_000,
            ProposedReservePrice = 8_000,
            SellerConfirmedAt = DateTime.UtcNow,
            TermsVersion = 1,
            AcceptedTermsVersion = 1
        };
        db.Users.Add(seller);
        db.Products.Add(product);
        db.LiveAuctionRequests.Add(request);
        await db.SaveChangesAsync();

        var added = await Service(db).AddLotAsync(10,
            new AddLiveLotDto { LiveAuctionRequestId = request.Id }, CancellationToken.None);

        Assert.Equal(2, added.LotNumber);
        Assert.Equal("Vintage watch", added.Title);
        Assert.Equal(nameof(LiveLotStatus.Pending), added.Status);
        Assert.Equal(20, (await db.LiveEvents.SingleAsync()).CurrentLotId);
        Assert.Equal(LiveAuctionRequestStatus.Scheduled, request.Status);
        Assert.Equal(10, request.ScheduledEventId);
    }

    [Theory]
    [InlineData(LiveEventStatus.Completed)]
    [InlineData(LiveEventStatus.Cancelled)]
    public async Task AddLot_RejectsEndedEvents(LiveEventStatus eventStatus)
    {
        await using var db = NewDatabase();
        await SeedEvent(db, eventStatus: eventStatus);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            Service(db).AddLotAsync(10, new AddLiveLotDto { LiveAuctionRequestId = 999 },
                CancellationToken.None));

        Assert.Equal("event_locked", error.Code);
    }

    [Fact]
    public async Task PlaceBid_RejectsBidsAfterPersistedDeadline()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, withSaleableBid: true);
        var lot = await db.LiveLots.SingleAsync();
        lot.CurrentEndAt = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            Service(db, CurrentUserFor(db, 3)).PlaceBidAsync(20, 1_100, CancellationToken.None));

        Assert.Equal("bidding_deadline_passed", error.Code);
        Assert.Single(await db.LiveBids.ToListAsync());
    }

    [Fact]
    public async Task Automation_ClosesExpiredAutomaticLotAndCreatesOrderOnce()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, withSaleableBid: true);
        var auctionEvent = await db.LiveEvents.SingleAsync();
        auctionEvent.OperationMode = LiveOperationMode.Automatic;
        auctionEvent.AutoCloseLots = true;
        var lot = await db.LiveLots.SingleAsync();
        lot.CurrentEndAt = DateTime.UtcNow.AddSeconds(-1);
        lot.OriginalEndAt = lot.CurrentEndAt;
        await db.SaveChangesAsync();

        await Service(db).ProcessAutomationTickAsync(CancellationToken.None);
        await Service(db).ProcessAutomationTickAsync(CancellationToken.None);

        var closedLot = await db.LiveLots.AsNoTracking().SingleAsync();
        Assert.Equal(LiveLotStatus.Sold, closedLot.Status);
        Assert.Equal(LiveLotCloseMethod.Automatic, closedLot.CloseMethod);
        Assert.Equal(3, closedLot.WinnerId);
        Assert.Single(await db.Orders.ToListAsync());
    }

    [Fact]
    public async Task Automation_HybridLotWaitsForAdminConfirmationBeforeCreatingOrder()
    {
        await using var db = NewDatabase();
        await SeedEvent(db, withSaleableBid: true);
        var auctionEvent = await db.LiveEvents.SingleAsync();
        auctionEvent.OperationMode = LiveOperationMode.Hybrid;
        var lot = await db.LiveLots.SingleAsync();
        lot.CurrentEndAt = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
        var service = Service(db);

        await service.ProcessAutomationTickAsync(CancellationToken.None);

        var awaitingLot = await db.LiveLots.AsNoTracking().SingleAsync();
        Assert.Equal(LiveLotStatus.AwaitingConfirmation, awaitingLot.Status);
        Assert.Empty(await db.Orders.ToListAsync());

        await service.ConfirmLotResultAsync(lot.Id, CancellationToken.None);

        var confirmedLot = await db.LiveLots.AsNoTracking().SingleAsync();
        Assert.Equal(LiveLotStatus.Sold, confirmedLot.Status);
        Assert.Equal(LiveLotCloseMethod.HybridConfirmed, confirmedLot.CloseMethod);
        Assert.Single(await db.Orders.ToListAsync());
    }

    [Fact]
    public async Task PauseAndResume_PreserveRemainingLotTime()
    {
        await using var db = NewDatabase();
        await SeedEvent(db);
        var lot = await db.LiveLots.SingleAsync();
        lot.CurrentEndAt = DateTime.UtcNow.AddMinutes(2);
        await db.SaveChangesAsync();
        var service = Service(db);

        await service.PauseAsync(10, false, CancellationToken.None);

        Assert.True(lot.RemainingSecondsOnPause > 0);
        Assert.Equal(LiveEventStatus.Paused, (await db.LiveEvents.SingleAsync()).Status);

        await service.PauseAsync(10, true, CancellationToken.None);

        Assert.Null(lot.RemainingSecondsOnPause);
        Assert.Equal(LiveEventStatus.Live, (await db.LiveEvents.SingleAsync()).Status);
        Assert.True(lot.CurrentEndAt > DateTime.UtcNow);
    }
}
