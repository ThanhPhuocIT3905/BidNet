using System.Security.Claims;
using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace BidNet.Tests;

public class LiveAuctionRequestTests
{
    private static AppDbContext NewDatabase() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static CurrentUser CurrentUser(AppDbContext db, int userId)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Test"));
        return new CurrentUser(new HttpContextAccessor { HttpContext = context }, db);
    }

    private static LiveAuctionRequestService RequestService(AppDbContext db, int userId) =>
        new(db, CurrentUser(db, userId),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auction:MinBidIncrement"] = "1000"
            }).Build());

    private static async Task<(User Seller, Product Product)> SeedSellerProduct(AppDbContext db)
    {
        var seller = new User { Id = 1, Username = "seller", Email = "seller@example.com" };
        var product = new Product
        {
            Id = 10,
            Name = "Camera",
            Seller = seller,
            SellerId = seller.Id,
            StartingPrice = 10_000,
            CurrentPrice = 10_000,
            StartTime = DateTime.UtcNow.AddDays(1),
            EndTime = DateTime.UtcNow.AddDays(2),
            Status = ProductStatus.Scheduled
        };
        db.Users.Add(seller);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return (seller, product);
    }

    [Fact]
    public async Task Create_RequiresConsentAndKeepsTimedAuctionPriceUntilApproved()
    {
        await using var db = NewDatabase();
        var (_, product) = await SeedSellerProduct(db);
        var service = RequestService(db, 1);

        var consentError = await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(
            new CreateLiveAuctionRequestDto
            {
                ProductId = product.Id,
                ProposedStartingPrice = 12_000,
                ProposedBidIncrement = 1_000
            },
            CancellationToken.None));

        Assert.Equal("seller_consent_required", consentError.Code);

        await service.CreateAsync(
            new CreateLiveAuctionRequestDto
            {
                ProductId = product.Id,
                ProposedStartingPrice = 12_000,
                ProposedBidIncrement = 1_000,
                SellerConsent = true
            },
            CancellationToken.None);

        Assert.Equal(ProductAuctionType.Live, product.AuctionType);
        Assert.Equal(10_000, product.StartingPrice);
        Assert.Equal(LiveAuctionRequestStatus.PendingReview, (await db.LiveAuctionRequests.SingleAsync()).Status);
    }

    [Fact]
    public async Task Reject_RestoresProductToTimedAuctionInventory()
    {
        await using var db = NewDatabase();
        var (_, product) = await SeedSellerProduct(db);
        var sellerService = RequestService(db, 1);
        var request = await sellerService.CreateAsync(
            new CreateLiveAuctionRequestDto
            {
                ProductId = product.Id,
                ProposedStartingPrice = 12_000,
                ProposedBidIncrement = 1_000,
                SellerConsent = true
            },
            CancellationToken.None);
        var admin = new User { Id = 2, Username = "admin", Email = "admin@example.com", Role = "Admin" };
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        var adminService = RequestService(db, admin.Id);

        await adminService.RejectAsync(request.Id,
            new LiveAuctionRequestMessageDto { Message = "Thiếu thông tin." },
            CancellationToken.None);

        Assert.Equal(ProductAuctionType.Timed, product.AuctionType);
        Assert.Equal(LiveAuctionRequestStatus.Rejected, (await db.LiveAuctionRequests.SingleAsync()).Status);
    }

    [Fact]
    public async Task EligibleProducts_IncludesOwnedDraftUpcomingAndUnbidCancelledProducts()
    {
        await using var db = NewDatabase();
        var (seller, _) = await SeedSellerProduct(db);
        seller.FullName = "Seller Example";
        var otherSeller = new User { Id = 2, Username = "other", Email = "other@example.com" };
        db.Users.Add(otherSeller);
        db.Products.AddRange(
            Product(11, seller, ProductStatus.Draft, DateTime.UtcNow.AddDays(1)),
            Product(12, seller, ProductStatus.Cancelled, DateTime.UtcNow.AddDays(-2)),
            Product(13, seller, ProductStatus.Active, DateTime.UtcNow.AddDays(-1)),
            Product(14, otherSeller, ProductStatus.Scheduled, DateTime.UtcNow.AddDays(1)));
        await db.SaveChangesAsync();

        var eligible = await RequestService(db, seller.Id)
            .EligibleProductsAsync(CancellationToken.None);

        Assert.Equal(new[] { 10, 11, 12 }, eligible.Select(item => item.Id).Order().ToArray());
        Assert.All(eligible, item => Assert.Equal("Seller Example", item.SellerName));
        Assert.Contains(eligible, item => item.Id == 11 && item.Status == nameof(ProductStatus.Draft));
        Assert.Contains(eligible, item => item.Id == 12 && item.Status == nameof(ProductStatus.Cancelled));
    }

    [Fact]
    public async Task CreateDraftProduct_IsPrivateUntilPublished()
    {
        await using var db = NewDatabase();
        await SeedSellerProduct(db);
        var service = new ProductService(db, CurrentUser(db, 1),
            new ConfigurationBuilder().AddInMemoryCollection().Build());
        var start = DateTime.UtcNow.AddDays(1);

        var draft = await service.CreateAsync(new CreateProductDto
        {
            Name = "Draft camera",
            StartingPrice = 10_000,
            StartTime = start,
            EndTime = start.AddDays(1),
            Publish = false
        }, CancellationToken.None);

        var publicListings = await service.ListAsync(new ProductQueryDto(), CancellationToken.None);
        var sellerListings = await service.MineAsync(1, 20, CancellationToken.None);

        Assert.Equal(nameof(ProductStatus.Draft), draft.Status);
        Assert.DoesNotContain(publicListings.Items, item => item.Id == draft.Id);
        Assert.Contains(sellerListings.Items, item => item.Id == draft.Id && item.Status == nameof(ProductStatus.Draft));
    }

    private static Product Product(int id, User seller, ProductStatus status, DateTime startTime) => new()
    {
        Id = id,
        Name = $"Product {id}",
        Seller = seller,
        SellerId = seller.Id,
        StartingPrice = 10_000,
        CurrentPrice = 10_000,
        StartTime = startTime,
        EndTime = startTime.AddDays(1),
        Status = status
    };
}
