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
        public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
        public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();
        public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
        public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
        public DbSet<LiveEvent> LiveEvents => Set<LiveEvent>();
        public DbSet<LiveLot> LiveLots => Set<LiveLot>();
        public DbSet<LiveBid> LiveBids => Set<LiveBid>();
        public DbSet<LiveRegistration> LiveRegistrations => Set<LiveRegistration>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Fluent API đặt ràng buộc thật ở SQL Server, không chỉ kiểm tra ở C#.
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<User>().ToTable(t => t.HasCheckConstraint("CK_Users_Gender", "[Gender] IS NULL OR [Gender] IN ('Male','Female','Other','PreferNotToSay')"));
            modelBuilder.Entity<SupportTicket>().HasOne(t => t.Requester).WithMany().HasForeignKey(t => t.RequesterId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportTicket>().HasOne(t => t.Product).WithMany().HasForeignKey(t => t.ProductId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportTicket>().HasOne(t => t.Order).WithMany().HasForeignKey(t => t.OrderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportTicket>().HasIndex(t => new { t.RequesterId, t.UpdatedAt });
            modelBuilder.Entity<SupportTicket>().HasIndex(t => new { t.Status, t.UpdatedAt });
            modelBuilder.Entity<SupportMessage>().HasOne(m => m.Ticket).WithMany(t => t.Messages).HasForeignKey(m => m.TicketId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportMessage>().HasOne(m => m.Author).WithMany().HasForeignKey(m => m.AuthorId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportMessage>().HasIndex(m => new { m.TicketId, m.CreatedAt, m.Id });
            modelBuilder.Entity<OrderEvent>().HasOne(e => e.Order).WithMany(o => o.Events).HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<OrderEvent>().HasOne(e => e.Actor).WithMany().HasForeignKey(e => e.ActorId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<OrderEvent>().HasIndex(e => new { e.OrderId, e.CreatedAt, e.Id });
            modelBuilder.Entity<AdminAuditLog>().HasOne(e => e.Actor).WithMany().HasForeignKey(e => e.ActorId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<AdminAuditLog>().HasIndex(e => new { e.EntityType, e.EntityId, e.CreatedAt });
            modelBuilder.Entity<AdminAuditLog>().HasIndex(e => new { e.CreatedAt, e.Id });
            modelBuilder.Entity<Order>().HasIndex(o => new { o.Status, o.CreatedAt });
            modelBuilder.Entity<Notification>().HasOne<Product>().WithMany().HasForeignKey(n => n.ProductId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Notification>().HasOne(n => n.Order).WithMany().HasForeignKey(n => n.OrderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Notification>().HasOne(n => n.Ticket).WithMany().HasForeignKey(n => n.TicketId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SupportTicket>().ToTable(t => t.HasCheckConstraint("CK_SupportTickets_Status", "[Status] IN (0,1,2)"));
            modelBuilder.Entity<Order>().ToTable(t => {
                t.HasCheckConstraint("CK_Orders_Status", "[Status] IN (0,1,2,3)");
                t.HasCheckConstraint("CK_Orders_Price", "[FinalPrice] > 0 AND [FinalPrice] = FLOOR([FinalPrice])");
                t.HasCheckConstraint("CK_Orders_Parties", "[BuyerId] <> [SellerId]");
                t.HasCheckConstraint("CK_Orders_PaymentStatus", "[PaymentStatus] IN (0,1)");
                t.HasCheckConstraint("CK_Orders_PaymentMethod", "[PaymentMethod] IS NULL OR [PaymentMethod] IN ('BANK_TRANSFER_DEMO','MOMO_DEMO')");
            });
            modelBuilder.Entity<Product>().ToTable(t => {
                t.HasCheckConstraint("CK_Products_Status", "[Status] IN (0,1,2,3)");
                t.HasCheckConstraint("CK_Products_Time", "[EndTime] > [StartTime]");
                t.HasCheckConstraint("CK_Products_Prices", "[StartingPrice] >= 1000 AND [CurrentPrice] >= [StartingPrice] AND [StartingPrice] = FLOOR([StartingPrice]) AND [CurrentPrice] = FLOOR([CurrentPrice])");
            });
            modelBuilder.Entity<Bid>().ToTable(t => t.HasCheckConstraint("CK_Bids_Amount", "[Amount] > 0 AND [Amount] = FLOOR([Amount])"));
            modelBuilder.Entity<User>().ToTable(t => t.HasCheckConstraint("CK_Users_Role", "[Role] IN ('User','Admin')"));

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
                .HasIndex(o => o.PaymentTransactionId)
                .IsUnique()
                .HasFilter("[PaymentTransactionId] IS NOT NULL");

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

            // ── 3. Cấu hình đấu giá trực tiếp ────────────────────────────────────────
            modelBuilder.Entity<LiveEvent>().HasIndex(e => e.Code).IsUnique();
            modelBuilder.Entity<LiveEvent>().HasIndex(e => new { e.Status, e.ScheduledStartAt });
            modelBuilder.Entity<LiveEvent>().HasOne(e => e.CreatedBy).WithMany()
                .HasForeignKey(e => e.CreatedById).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveEvent>().HasMany(e => e.Lots).WithOne(l => l.Event)
                .HasForeignKey(l => l.EventId).OnDelete(DeleteBehavior.Cascade);
            // Sản phẩm chỉ thuộc một lô; lô chỉ thuộc một sự kiện.
            // Lô không bán được có thể được xếp lại vào sự kiện khác, nên chỉ
            // unique trên các lô còn hiệu lực (Pending/Open/Paused/Sold).
            modelBuilder.Entity<LiveLot>().HasIndex(l => l.ProductId).IsUnique()
                .HasFilter("[Status] NOT IN (4, 5, 6)");
            modelBuilder.Entity<LiveLot>().HasIndex(l => new { l.EventId, l.SequenceNumber }).IsUnique();
            modelBuilder.Entity<LiveLot>().HasIndex(l => new { l.Status, l.EventId });
            modelBuilder.Entity<LiveLot>().HasOne(l => l.Product).WithMany()
                .HasForeignKey(l => l.ProductId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveLot>().HasOne(l => l.Seller).WithMany()
                .HasForeignKey(l => l.SellerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveLot>().HasOne(l => l.LeadingBidder).WithMany()
                .HasForeignKey(l => l.LeadingBidderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveLot>().HasOne(l => l.Winner).WithMany()
                .HasForeignKey(l => l.WinnerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveBid>().HasOne(b => b.Lot).WithMany(l => l.Bids)
                .HasForeignKey(b => b.LotId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveBid>().HasOne(b => b.User).WithMany()
                .HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveBid>().HasIndex(b => new { b.LotId, b.Amount, b.BidTime });
            modelBuilder.Entity<LiveRegistration>().HasIndex(r => new { r.EventId, r.UserId }).IsUnique();
            modelBuilder.Entity<LiveRegistration>().HasOne(r => r.Event).WithMany(e => e.Registrations)
                .HasForeignKey(r => r.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<LiveRegistration>().HasOne(r => r.User).WithMany()
                .HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LiveRegistration>().ToTable(t =>
                t.HasCheckConstraint("CK_LiveRegistrations_Status", "[Status] IN (0,1,2,3,4)"));
            modelBuilder.Entity<LiveLot>().ToTable(t =>
                t.HasCheckConstraint("CK_LiveLots_Status", "[Status] IN (0,1,2,3,4,5,6)"));

            // ── 4. Cấu hình bảng Notifications ───────────────────────────────────────
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
