using System.Security.Claims;
using BidNet.Data;
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

    private static async Task SeedEvent(AppDbContext db, LiveLotStatus lotStatus = LiveLotStatus.Open,
        bool withSaleableBid = false, int? currentLotId = 20)
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
            CreatedBy = admin, Status = LiveEventStatus.Live, CurrentLotId = currentLotId
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
}
