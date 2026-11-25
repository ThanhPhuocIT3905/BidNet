using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Data
{
    public class AppDbContext : DbContext
    {
        // Nhận cấu hình database đã đăng ký trong Program.cs.
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        // DbSet là điểm bắt đầu truy vấn và ghi dữ liệu; migration tạo ba bảng này.
        public DbSet<User> Users => Set<User>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Bid> Bids => Set<Bid>();
        public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<ProductImage> ProductImages => Set<ProductImage>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Fluent API đặt ràng buộc thật ở SQL Server, không chỉ kiểm tra ở C#.
            base.OnModelCreating(modelBuilder);

            // Hai unique index bảo vệ dữ liệu ngay cả khi nhiều request đăng ký đồng thời.
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<Product>()
                // Tăng tốc truy vấn các phiên cần mở/đóng theo thời gian.
                .HasIndex(p => new { p.Status, p.StartTime, p.EndTime });

            // Restrict: không xóa User nếu còn sản phẩm; giữ lịch sử người bán.
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Seller)
                .WithMany(u => u.ListedProducts)
                .HasForeignKey(p => p.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Restrict: không xóa người thắng và làm mất dấu kết quả đấu giá.
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Winner)
                .WithMany(u => u.WonProducts)
                .HasForeignKey(p => p.WinnerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Nếu thật sự xóa Product, các bid con bị xóa theo để không mồ côi.
            modelBuilder.Entity<Bid>()
                .HasOne(b => b.Product)
                .WithMany(p => p.Bids)
                .HasForeignKey(b => b.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            // Không cho xóa User đã đặt giá để bảo toàn lịch sử phiên.
            modelBuilder.Entity<Bid>()
                .HasOne(b => b.User)
                .WithMany(u => u.Bids)
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Bid>()
                // Tăng tốc lịch sử bid theo từng sản phẩm.
                .HasIndex(b => new { b.ProductId, b.BidTime });

            modelBuilder.Entity<Product>()
                .HasOne(p => p.CategoryEntity)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<ProductImage>()
                .HasOne(i => i.Product)
                .WithMany(p => p.Images)
                .HasForeignKey(i => i.ProductId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<ProductImage>()
                .Property(i => i.CloudinaryPublicId)
                .HasDefaultValue(string.Empty);

            modelBuilder.Entity<ProductImage>()
                .Property(i => i.CloudinaryUrl)
                .HasDefaultValue(string.Empty);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Product)
                .WithMany(p => p.Orders)
                .HasForeignKey(o => o.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Buyer)
                .WithMany(u => u.BuyerOrders)
                .HasForeignKey(o => o.BuyerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Seller)
                .WithMany(u => u.SellerOrders)
                .HasForeignKey(o => o.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
        }
    }
}
