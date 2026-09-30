using BidNet.Data;
using BidNet.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BidNet.Tests;

public class SqlConcurrencyTests
{
    [Fact]
    public async Task StaleBid_CannotOverwriteCommittedPrice()
    {
        // Test này chỉ chạy khi chủ động bật; luôn dùng database tạm có tên riêng.
        if (Environment.GetEnvironmentVariable("BIDNET_TEST_SQL") != "1") return;

        var baseConnection = Environment.GetEnvironmentVariable("BIDNET_TEST_SQL_CONNECTION")
            ?? throw new InvalidOperationException(
                "Thiếu BIDNET_TEST_SQL_CONNECTION để chạy test SQL Server.");
        // Luôn thay database trong chuỗi kết nối bằng tên GUID: test không bao giờ
        // migrate hoặc xóa database chính của thành viên chạy test.
        var builder = new SqlConnectionStringBuilder(baseConnection)
        {
            InitialCatalog = "BidNet_Test_" + Guid.NewGuid().ToString("N"),
            Pooling = false
        };
        var connection = builder.ConnectionString;
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connection).Options;
        int productId = 0, buyer1Id = 0, buyer2Id = 0;
        try
        {
            await using (var setup = new AppDbContext(options))
            {
                await setup.Database.MigrateAsync();
                var seller = new User { Username = "seller", Email = "seller@example.com" };
                var buyer1 = new User { Username = "buyer1", Email = "buyer1@example.com" };
                var buyer2 = new User { Username = "buyer2", Email = "buyer2@example.com" };
                setup.Users.AddRange(seller, buyer1, buyer2);
                await setup.SaveChangesAsync();
                buyer1Id = buyer1.Id;
                buyer2Id = buyer2.Id;
                var product = new Product
                {
                    Name = "Máy ảnh", SellerId = seller.Id,
                    StartingPrice = 1000, CurrentPrice = 1000,
                    StartTime = DateTime.UtcNow.AddMinutes(-1),
                    EndTime = DateTime.UtcNow.AddHours(1),
                    Status = ProductStatus.Active
                };
                setup.Products.Add(product);
                await setup.SaveChangesAsync();
                productId = product.Id;
            }

            await using var first = new AppDbContext(options);
            await using var second = new AppDbContext(options);
            var firstProduct = await first.Products.SingleAsync();
            var secondProduct = await second.Products.SingleAsync();
            // Hai request đọc cùng RowVersion; request lưu sau phải bị từ chối.
            first.Bids.Add(new Bid { ProductId = productId, UserId = buyer1Id, Amount = 2000 });
            firstProduct.CurrentPrice = 2000;
            second.Bids.Add(new Bid { ProductId = productId, UserId = buyer2Id, Amount = 3000 });
            secondProduct.CurrentPrice = 3000;
            // Request thứ nhất thắng; request thứ hai vẫn giữ RowVersion cũ nên
            // SQL Server từ chối UPDATE và EF ném DbUpdateConcurrencyException.
            await first.SaveChangesAsync();
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

            await using var verify = new AppDbContext(options);
            Assert.Equal(2000, (await verify.Products.SingleAsync()).CurrentPrice);
            Assert.Equal(1, await verify.Bids.CountAsync());
        }
        finally
        {
            // Chỉ xóa database thử nghiệm mang tên GUID, không đụng database thật.
            await using var cleanup = new AppDbContext(options);
            await cleanup.Database.EnsureDeletedAsync();
        }
    }
}
