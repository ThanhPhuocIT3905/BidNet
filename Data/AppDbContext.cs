using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Data
{
    public class AppDbContext : DbContext
    {
        // Nhận cấu hình database đã đăng ký trong Program.cs.
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        // DbSet là điểm bắt đầu truy vấn và ghi dữ liệu; migration tạo 7 bảng này.
        public DbSet<User> Users => Set<User>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Bid> Bids => Set<Bid>();
        public DbSet<ProductImage> ProductImages => Set<ProductImage>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<Notification> Notifications => Set<Notification>();

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

            // SetNull: khi xóa Product, ảnh vẫn giữ lại nhưng ProductId thành null.
            modelBuilder.Entity<ProductImage>()
                .HasOne(pi => pi.Product)
                .WithMany(p => p.Images)
                .HasForeignKey(pi => pi.ProductId)
                .OnDelete(DeleteBehavior.SetNull);

            // ── 1. Cấu hình bảng Categories ─────────────────────────────────────────
            // Tên danh mục là duy nhất để tránh trùng lặp
            modelBuilder.Entity<Category>()
                .HasIndex(c => c.Name)
                .IsUnique();

            // SetNull: Khi xóa Category, sản phẩm chuyển CategoryId về null (không xóa mất sản phẩm)
            modelBuilder.Entity<Product>()
                .HasOne(p => p.CategoryRef)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            // ── 2. Cấu hình bảng Orders ──────────────────────────────────────────────
            // Mỗi sản phẩm chỉ sinh tối đa 1 đơn hàng khi đấu giá kết thúc
            modelBuilder.Entity<Order>()
                .HasIndex(o => o.ProductId)
                .IsUnique();

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Product)
                .WithOne(p => p.Order)
                .HasForeignKey<Order>(o => o.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // Restrict: Không xóa User nếu đang có đơn hàng liên quan để giữ lịch sử giao dịch
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Buyer)
                .WithMany(u => u.BoughtOrders)
                .HasForeignKey(o => o.BuyerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Seller)
                .WithMany(u => u.SoldOrders)
                .HasForeignKey(o => o.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            // ── 3. Cấu hình bảng Notifications ───────────────────────────────────────
            // Tăng tốc truy vấn danh sách thông báo theo từng người dùng
            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead });

            // Cascade: Khi xóa tài khoản User, các thông báo liên quan được xóa theo
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
