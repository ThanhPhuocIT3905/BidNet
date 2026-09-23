using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Data
{
    public class AppDbContext : DbContext
    {
        // Nhận cấu hình database đã đăng ký trong Program.cs.
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        // Mỗi DbSet tương ứng với một bảng trong database.
        public DbSet<User> Users => Set<User>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Bid> Bids => Set<Bid>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Username và Email không được trùng nhau.
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // Một User có thể đăng bán nhiều Product.
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Seller)
                .WithMany(u => u.ListedProducts)
                .HasForeignKey(p => p.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Một User có thể thắng nhiều Product.
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Winner)
                .WithMany(u => u.WonProducts)
                .HasForeignKey(p => p.WinnerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Một Product có nhiều lượt Bid.
            modelBuilder.Entity<Bid>()
                .HasOne(b => b.Product)
                .WithMany(p => p.Bids)
                .HasForeignKey(b => b.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            // Một User có thể thực hiện nhiều lượt Bid.
            modelBuilder.Entity<Bid>()
                .HasOne(b => b.User)
                .WithMany(u => u.Bids)
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
