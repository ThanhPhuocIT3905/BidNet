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
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace BidNet.Tests;

public class AuctionRulesTests
{
    // Mỗi test dùng database InMemory riêng để dữ liệu không ảnh hưởng lẫn nhau.
    // InMemory kiểm quy tắc C# nhanh; RowVersion thực tế được test riêng với SQL Server.
    private static AppDbContext NewDatabase() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static CurrentUser Current(AppDbContext db, int userId)
    {
        // Giả lập claim trong JWT để kiểm tra quyền mà không cần mở server HTTP.
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Test"));
        return new CurrentUser(new HttpContextAccessor { HttpContext = context }, db);
    }

    private static IConfiguration Settings() => new ConfigurationBuilder()
        // Cấu hình cố định giúp test không phụ thuộc User Secrets của từng máy.
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = new string('a', 48),
            ["Jwt:Issuer"] = "BidNet",
            ["Jwt:Audience"] = "BidNet",
            ["Jwt:ExpireMinutes"] = "60",
            ["Auction:MinBidIncrement"] = "1000"
        }).Build();

    [Fact]
    public async Task RegisterAndLogin_UsesHashedPasswordAndRejectsBlockedUser()
    {
        await using var db = NewDatabase();
        var auth = new AuthService(db, Settings());
        var registered = await auth.RegisterAsync(
            new UserRegisterDto { Username = "buyer", Email = "buyer@example.com", Password = "password123" },
            CancellationToken.None);
        var user = await db.Users.SingleAsync();
        Assert.Equal("User", registered.Role);
        Assert.NotEmpty(user.PasswordHash);
        Assert.NotEqual("password123", System.Text.Encoding.UTF8.GetString(user.PasswordHash));
        Assert.NotEmpty((await auth.LoginAsync(new UserLoginDto
        { UsernameOrEmail = user.Email, Password = "password123" }, CancellationToken.None)).AccessToken);
        user.IsActive = false;
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<ApiException>(() => auth.LoginAsync(
            new UserLoginDto { UsernameOrEmail = user.Username, Password = "password123" },
            CancellationToken.None));
        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public async Task Register_RejectsDuplicateUsernameOrEmail()
    {
        await using var db = NewDatabase();
        var auth = new AuthService(db, Settings());
        await auth.RegisterAsync(new UserRegisterDto
        { Username = "buyer", Email = "buyer@example.com", Password = "password123" }, CancellationToken.None);
        var error = await Assert.ThrowsAsync<ApiException>(() => auth.RegisterAsync(new UserRegisterDto
        { Username = "buyer", Email = "other@example.com", Password = "password123" }, CancellationToken.None));
        Assert.Equal(409, error.StatusCode);
    }

    [Fact]
    public async Task Product_ValidatesPriceAndKeepsSellerFromIdentity()
    {
        await using var db = NewDatabase();
        db.Users.Add(new User { Id = 1, Username = "seller", Email = "seller@example.com" });
        await db.SaveChangesAsync();
        var service = new ProductService(db, Current(db, 1));
        var request = new CreateProductDto
        {
            Name = "Máy ảnh", StartingPrice = 1000.5m,
            StartTime = DateTime.UtcNow.AddMinutes(10), EndTime = DateTime.UtcNow.AddHours(1)
        };
        var error = await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(request, CancellationToken.None));
        Assert.Equal(400, error.StatusCode);
        request.StartingPrice = 1000;
        var product = await service.CreateAsync(request, CancellationToken.None);
        Assert.Equal(1, product.SellerId);
        Assert.Equal("Scheduled", product.Status);
        Assert.Equal(1000, product.CurrentPrice);
    }

    [Fact]
    public async Task Bid_RejectsSellerAndInsufficientIncrement()
    {
        // Kiểm cả hai trường hợp: chủ sản phẩm không được bid và bid sau
        // phải vượt giá hiện tại theo bước cấu hình.
        await using var db = NewDatabase();
        db.Users.AddRange(
            new User { Id = 1, Username = "seller", Email = "seller@example.com" },
            new User { Id = 2, Username = "buyer", Email = "buyer@example.com" });
        db.Products.Add(new Product
        {
            Id = 1, Name = "Máy ảnh", SellerId = 1, StartingPrice = 1000, CurrentPrice = 1000,
            StartTime = DateTime.UtcNow.AddMinutes(-10), EndTime = DateTime.UtcNow.AddHours(1),
            Status = ProductStatus.Active
        });
        await db.SaveChangesAsync();
        var hub = new Mock<IHubContext<AuctionHub>>();
        var clients = new Mock<IHubClients>();
        var client = new Mock<IClientProxy>();
        client.Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(),
            It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(client.Object);
        hub.SetupGet(h => h.Clients).Returns(clients.Object);

        BidService Service(int id) => new(db, Current(db, id), Settings(), hub.Object,
            NullLogger<BidService>.Instance);
        var sellerError = await Assert.ThrowsAsync<ApiException>(() =>
            Service(1).PlaceAsync(1, 1000, CancellationToken.None));
        Assert.Equal(403, sellerError.StatusCode);

        var first = await Service(2).PlaceAsync(1, 1000, CancellationToken.None);
        Assert.Equal(1000, first.Amount);
        var lowError = await Assert.ThrowsAsync<ApiException>(() =>
            Service(2).PlaceAsync(1, 1500, CancellationToken.None));
        Assert.Equal(400, lowError.StatusCode);
        Assert.Single(await db.Bids.ToListAsync());
        Assert.Equal(1000, (await db.Products.SingleAsync()).CurrentPrice);
    }

    [Fact]
    public async Task Product_RejectsEditByAnotherUserAndAfterStart()
    {
        await using var db = NewDatabase();
        db.Users.AddRange(
            new User { Id = 1, Username = "seller", Email = "seller@example.com" },
            new User { Id = 2, Username = "other", Email = "other@example.com" });
        db.Products.Add(new Product
        {
            Id = 1, Name = "Máy ảnh", SellerId = 1, StartingPrice = 1000, CurrentPrice = 1000,
            StartTime = DateTime.UtcNow.AddMinutes(10), EndTime = DateTime.UtcNow.AddHours(1),
            Status = ProductStatus.Scheduled
        });
        await db.SaveChangesAsync();
        var request = new UpdateProductDto
        {
            Name = "Máy ảnh mới", StartingPrice = 2000,
            StartTime = DateTime.UtcNow.AddMinutes(20), EndTime = DateTime.UtcNow.AddHours(2)
        };
        var notOwner = await Assert.ThrowsAsync<ApiException>(() =>
            new ProductService(db, Current(db, 2)).UpdateAsync(1, request, CancellationToken.None));
        Assert.Equal(403, notOwner.StatusCode);
        (await db.Products.SingleAsync()).Status = ProductStatus.Active;
        await db.SaveChangesAsync();
        var started = await Assert.ThrowsAsync<ApiException>(() =>
            new ProductService(db, Current(db, 1)).UpdateAsync(1, request, CancellationToken.None));
        Assert.Equal(409, started.StatusCode);
    }

    [Fact]
    public async Task Bid_RejectsExpiredAuctionAndFractionalAmount()
    {
        await using var db = NewDatabase();
        db.Users.AddRange(
            new User { Id = 1, Username = "seller", Email = "seller@example.com" },
            new User { Id = 2, Username = "buyer", Email = "buyer@example.com" });
        db.Products.Add(new Product
        {
            Id = 1, Name = "Máy ảnh", SellerId = 1, StartingPrice = 1000, CurrentPrice = 1000,
            StartTime = DateTime.UtcNow.AddMinutes(-10), EndTime = DateTime.UtcNow.AddHours(1),
            Status = ProductStatus.Active
        });
        await db.SaveChangesAsync();
        var hub = new Mock<IHubContext<AuctionHub>>();
        var service = new BidService(db, Current(db, 2), Settings(), hub.Object,
            NullLogger<BidService>.Instance);
        var fraction = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceAsync(1, 1000.5m, CancellationToken.None));
        Assert.Equal(400, fraction.StatusCode);
        (await db.Products.SingleAsync()).EndTime = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
        var expired = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceAsync(1, 2000, CancellationToken.None));
        Assert.Equal(409, expired.StatusCode);
    }

    [Fact]
    public async Task Bid_RejectsInactiveAccountAndFutureAuction()
    {
        await using var db = NewDatabase();
        db.Users.AddRange(
            new User { Id = 1, Username = "seller", Email = "seller@example.com" },
            new User { Id = 2, Username = "buyer", Email = "buyer@example.com", IsActive = false });
        db.Products.Add(new Product
        {
            Id = 1, Name = "Máy ảnh", SellerId = 1, StartingPrice = 1000, CurrentPrice = 1000,
            StartTime = DateTime.UtcNow.AddMinutes(10), EndTime = DateTime.UtcNow.AddHours(1),
            Status = ProductStatus.Scheduled
        });
        await db.SaveChangesAsync();
        var hub = new Mock<IHubContext<AuctionHub>>();
        var service = new BidService(db, Current(db, 2), Settings(), hub.Object,
            NullLogger<BidService>.Instance);
        var blocked = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceAsync(1, 1000, CancellationToken.None));
        Assert.Equal(403, blocked.StatusCode);
        (await db.Users.FindAsync(2))!.IsActive = true;
        await db.SaveChangesAsync();
        var future = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceAsync(1, 1000, CancellationToken.None));
        Assert.Equal(409, future.StatusCode);
    }

    [Fact]
    public async Task ProductList_PaginatesAndFiltersByStatus()
    {
        await using var db = NewDatabase();
        db.Users.Add(new User { Id = 1, Username = "seller", Email = "seller@example.com" });
        db.Products.AddRange(
            new Product { Id = 1, Name = "Một", SellerId = 1, StartingPrice = 1000,
                CurrentPrice = 1000, Status = ProductStatus.Scheduled },
            new Product { Id = 2, Name = "Hai", SellerId = 1, StartingPrice = 2000,
                CurrentPrice = 2000, Status = ProductStatus.Active });
        await db.SaveChangesAsync();
        var service = new ProductService(db, Current(db, 1));
        var result = await service.ListAsync(new ProductQueryDto
        { Status = "Active", Page = 1, PageSize = 1 }, CancellationToken.None);
        Assert.Equal(1, result.TotalCount);
        Assert.Single(result.Items);
        Assert.Equal(2, result.Items[0].Id);
    }

    [Fact]
    public async Task Worker_ClosesExpiredAuctionAndChoosesHighestBidder()
    {
        // Worker chạy nền; vòng lặp đợi ngắn kiểm tra kết quả bất đồng bộ,
        // không cần chờ nguyên chu kỳ 5 giây nếu phiên đã được đóng.
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(dbName));
        await using var provider = services.BuildServiceProvider();
        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.AddRange(
                new User { Id = 1, Username = "seller", Email = "seller@example.com" },
                new User { Id = 2, Username = "buyer", Email = "buyer@example.com" });
            db.Products.Add(new Product
            {
                Id = 1, Name = "Máy ảnh", SellerId = 1, StartingPrice = 1000, CurrentPrice = 2000,
                StartTime = DateTime.UtcNow.AddHours(-2), EndTime = DateTime.UtcNow.AddMinutes(-1),
                Status = ProductStatus.Active
            });
            db.Bids.Add(new Bid { ProductId = 1, UserId = 2, Amount = 2000 });
            await db.SaveChangesAsync();
        }
        var hub = new Mock<IHubContext<AuctionHub>>();
        var clients = new Mock<IHubClients>();
        var client = new Mock<IClientProxy>();
        client.Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(),
            It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(client.Object);
        hub.SetupGet(h => h.Clients).Returns(clients.Object);
        var worker = new AuctionClosingService(provider.GetRequiredService<IServiceScopeFactory>(),
            hub.Object, NullLogger<AuctionClosingService>.Instance);
        await worker.StartAsync(CancellationToken.None);
        for (var attempt = 0; attempt < 40; attempt++)
        {
            await Task.Delay(50);
            await using var pollScope = provider.CreateAsyncScope();
            var status = await pollScope.ServiceProvider.GetRequiredService<AppDbContext>()
                .Products.Select(p => p.Status).SingleAsync();
            if (status == ProductStatus.Completed) break;
        }
        await worker.StopAsync(CancellationToken.None);
        await using var verifyScope = provider.CreateAsyncScope();
        var finished = await verifyScope.ServiceProvider.GetRequiredService<AppDbContext>()
            .Products.SingleAsync();
        Assert.Equal(ProductStatus.Completed, finished.Status);
        Assert.Equal(2, finished.WinnerId);
    }
}
