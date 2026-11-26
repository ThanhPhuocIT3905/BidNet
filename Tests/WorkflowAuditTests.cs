using System.Security.Claims;
using BidNet.Controllers;
using BidNet.Data;
using BidNet.DTOs;
using BidNet.Exceptions;
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

public class WorkflowAuditTests
{
    [Fact]
    public async Task Support_SavesRequestToActiveAdminNotifications()
    {
        await using var db = await Database();
        await new SupportController(db, Current(db, 3)).Send(new SupportRequest { Message = "Please check auction #1" }, default);
        var notification = await db.Notifications.SingleAsync();
        Assert.Equal(1, notification.UserId);
        Assert.Contains("buyer@example.com", notification.Message);
        Assert.Contains("Please check auction #1", notification.Message);
    }

    [Fact]
    public async Task Support_RejectsEmptyMessageAndUnavailableReceiver()
    {
        await using var db = await Database();
        var controller = new SupportController(db, Current(db, 3));
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => controller.Send(new SupportRequest { Message = " " }, default))).StatusCode);
        (await db.Users.FindAsync(1))!.IsActive = false;
        await db.SaveChangesAsync();
        Assert.Equal(503, (await Assert.ThrowsAsync<ApiException>(() => controller.Send(new SupportRequest { Message = "Need help" }, default))).StatusCode);
        Assert.Empty(db.Notifications);
    }

    [Theory]
    [InlineData(" a ")]
    [InlineData("buyer@example.com")]
    [InlineData("has space")]
    public async Task Register_RejectsAmbiguousOrTrimmedShortUsername(string username)
    {
        await using var db = await Database();
        var service = new AuthService(db, Config());
        Assert.Equal(400, (await Assert.ThrowsAsync<ApiException>(() => service.RegisterAsync(
            new UserRegisterDto { Username = username, Email = "new@example.com", Password = "Password123" }, default))).StatusCode);
    }

    [Fact]
    public void Timestamps_SerializeDatabaseValuesAsUtc()
    {
        var options = new System.Text.Json.JsonSerializerOptions();
        options.Converters.Add(new UtcDateTimeConverter());
        var utc = new DateTime(2026, 11, 25, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(utc, options),
            System.Text.Json.JsonSerializer.Serialize(DateTime.SpecifyKind(utc, DateTimeKind.Unspecified), options));
    }

    [Theory]
    [InlineData(ProductStatus.Active)]
    [InlineData(ProductStatus.Completed)]
    [InlineData(ProductStatus.Cancelled)]
    public async Task Photos_CannotChangeAfterAuctionOpens(ProductStatus status)
    {
        await using var db = await Database();
        (await db.Products.SingleAsync()).Status = status;
        db.ProductImages.Add(new ProductImage { Id = 1, ProductId = 1, FileName = "camera.png",
            CloudinaryUrl = "https://example.com/camera.png", CloudinaryPublicId = "qa-image", ContentType = "image/png" });
        await db.SaveChangesAsync();
        var service = new ProductImageService(db, Current(db, 2),
            new CloudinaryDotNet.Cloudinary(new CloudinaryDotNet.Account("test", "test", "test")),
            Mock.Of<IHttpClientFactory>(), NullLogger<ProductImageService>.Instance);
        var file = new FormFile(new MemoryStream([1, 2, 3]), 0, 3, "file", "camera.png") { Headers = new HeaderDictionary(), ContentType = "image/png" };
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.UploadAsync(1, file, default))).StatusCode);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.DeleteAsync(1, default))).StatusCode);
        Assert.Single(db.ProductImages);
    }

    private static CurrentUser Current(AppDbContext db, int id) => new(new HttpContextAccessor
    {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, id.ToString())], "Test")) }
    }, db);

    private static IConfiguration Config() => new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["Auction:MinBidIncrement"] = "1000" }).Build();

    private static async Task<AppDbContext> Database()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Users.AddRange(
            new User { Id = 1, Username = "admin", Role = "Admin", Email = "admin@example.com" },
            new User { Id = 2, Username = "seller", Role = "User", Email = "seller@example.com" },
            new User { Id = 3, Username = "buyer", Role = "User", Email = "buyer@example.com" },
            new User { Id = 4, Username = "other", Role = "User", Email = "other@example.com" });
        db.Categories.Add(new Category { Id = 1, Name = "Cameras" });
        db.Products.Add(new Product
        {
            Id = 1, Name = "Camera", SellerId = 2, CategoryId = 1, Category = "Cameras",
            StartingPrice = 10000, CurrentPrice = 10000, Status = ProductStatus.Active,
            StartTime = DateTime.UtcNow.AddHours(-1), EndTime = DateTime.UtcNow.AddHours(1)
        });
        db.Orders.Add(new Order { Id = 1, ProductId = 1, BuyerId = 3, SellerId = 2,
            FinalPrice = 10000, ShippingAddress = "123 Main Street" });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task Admin_CannotBidOrCreateListing()
    {
        await using var db = await Database();
        var bids = new BidService(db, Current(db, 1), Config(), new Mock<IHubContext<AuctionHub>>().Object,
            NullLogger<BidService>.Instance);
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => bids.PlaceAsync(1, 10000, default))).StatusCode);
        var products = new ProductService(db, Current(db, 1), Config());
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => products.CreateAsync(new CreateProductDto
        {
            Name = "Admin listing", StartingPrice = 10000,
            StartTime = DateTime.UtcNow.AddHours(1), EndTime = DateTime.UtcNow.AddHours(2)
        }, default))).StatusCode);
        Assert.Empty(db.Bids);
        Assert.Single(db.Products);
    }

    [Theory]
    [InlineData(ProductStatus.Scheduled)]
    [InlineData(ProductStatus.Completed)]
    [InlineData(ProductStatus.Cancelled)]
    public async Task NonActiveAuction_RejectsBid(ProductStatus status)
    {
        await using var db = await Database();
        (await db.Products.SingleAsync()).Status = status;
        await db.SaveChangesAsync();
        var service = new BidService(db, Current(db, 3), Config(), new Mock<IHubContext<AuctionHub>>().Object,
            NullLogger<BidService>.Instance);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => service.PlaceAsync(1, 10000, default))).StatusCode);
        Assert.Empty(db.Bids);
    }

    [Theory]
    [InlineData(OrderStatus.Delivered)]
    [InlineData(OrderStatus.Cancelled)]
    public async Task ClosedOrder_RejectsAddressChange(OrderStatus status)
    {
        await using var db = await Database();
        (await db.Orders.SingleAsync()).Status = status;
        await db.SaveChangesAsync();
        var controller = new OrdersController(db, Current(db, 3));
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => controller.UpdateShippingAddress(1,
            new UpdateShippingAddressDto { ShippingAddress = "Different address" }, default))).StatusCode);
        Assert.Equal("123 Main Street", (await db.Orders.SingleAsync()).ShippingAddress);
    }

    [Fact]
    public async Task Order_RejectsOtherUsersAndBuyerStatusChanges()
    {
        await using var db = await Database();
        await Assert.ThrowsAsync<ForbiddenException>(() => new OrdersController(db, Current(db, 4)).GetById(1, default));
        await Assert.ThrowsAsync<ForbiddenException>(() => new OrdersController(db, Current(db, 2))
            .UpdateShippingAddress(1, new UpdateShippingAddressDto { ShippingAddress = "Other address" }, default));
        await Assert.ThrowsAsync<ForbiddenException>(() => new OrdersController(db, Current(db, 3))
            .UpdateStatus(1, new UpdateOrderStatusDto { Status = OrderStatus.Paid }, default));
    }

    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Delivered)]
    [InlineData(OrderStatus.Paid, OrderStatus.Pending)]
    [InlineData(OrderStatus.Paid, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Delivered, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Paid)]
    public async Task Order_RejectsInvalidTransition(OrderStatus from, OrderStatus to)
    {
        await using var db = await Database();
        (await db.Orders.SingleAsync()).Status = from;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<BadRequestException>(() => new OrdersController(db, Current(db, 2))
            .UpdateStatus(1, new UpdateOrderStatusDto { Status = to }, default));
    }

    [Fact]
    public async Task Order_RequiresAddressAndPreservesCompletionOnRetry()
    {
        await using var db = await Database();
        var order = await db.Orders.SingleAsync();
        order.Status = OrderStatus.Paid;
        order.ShippingAddress = null;
        await db.SaveChangesAsync();
        var controller = new OrdersController(db, Current(db, 2));
        var request = new UpdateOrderStatusDto { Status = OrderStatus.Delivered };
        await Assert.ThrowsAsync<BadRequestException>(() => controller.UpdateStatus(1, request, default));
        order.ShippingAddress = "123 Main Street";
        await db.SaveChangesAsync();
        await controller.UpdateStatus(1, request, default);
        var completed = order.CompletedAt;
        Assert.NotNull(completed);
        await controller.UpdateStatus(1, request, default);
        Assert.Equal(completed, order.CompletedAt);
    }

    [Fact]
    public async Task CategoryRename_UpdatesProductAndInUseCategoryCannotBeDeleted()
    {
        await using var db = await Database();
        var controller = new CategoriesController(db, Current(db, 1));
        await controller.Update(1, new CategoryUpdateDto { Name = "Photography" }, default);
        Assert.Equal("Photography", (await db.Products.SingleAsync()).Category);
        Assert.Equal(409, (await Assert.ThrowsAsync<ApiException>(() => controller.Delete(1, default))).StatusCode);
        Assert.Single(db.Categories);
    }

    [Fact]
    public async Task AdminPermission_ReadsCurrentDatabaseRole()
    {
        await using var db = await Database();
        var current = Current(db, 1);
        await current.RequireAdminAsync(default);
        (await db.Users.FindAsync(1))!.Role = "User";
        await db.SaveChangesAsync();
        Assert.Equal(403, (await Assert.ThrowsAsync<ApiException>(() => current.RequireAdminAsync(default))).StatusCode);
    }

    [Fact]
    public async Task ScheduledSeedProduct_CanKeepLocalImageWhenEditing()
    {
        await using var db = await Database();
        var product = await db.Products.SingleAsync();
        product.Status = ProductStatus.Scheduled;
        product.StartTime = DateTime.UtcNow.AddHours(1);
        product.EndTime = DateTime.UtcNow.AddHours(2);
        product.ImageUrl = "/images/products/camera.webp";
        await db.SaveChangesAsync();
        var result = await new ProductService(db, Current(db, 2), Config()).UpdateAsync(1,
            new UpdateProductDto { Name = "Updated camera", StartingPrice = 10000,
                StartTime = product.StartTime, EndTime = product.EndTime, ImageUrl = product.ImageUrl }, default);
        Assert.Equal(product.ImageUrl, result.ImageUrl);
    }
}
