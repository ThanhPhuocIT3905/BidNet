using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models
{
    public class Product
    {
        // Entity ánh xạ bảng Products; giá trong SQL là decimal(18,2),
        // còn service yêu cầu nhập số nguyên VND theo quy tắc nghiệp vụ.
        [Key]
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal StartingPrice { get; set; }

        // CurrentPrice bắt đầu bằng StartingPrice và đổi sau mỗi bid hợp lệ.
        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentPrice { get; set; }

        // Giờ lưu UTC; worker dùng StartTime/EndTime để tự mở và đóng phiên.
        [Required]
        public DateTime StartTime { get; set; }

        [Required]
        public DateTime EndTime { get; set; }

        [Required]
        public ProductStatus Status { get; set; } = ProductStatus.Scheduled;

        [ForeignKey("Seller")]
        public int SellerId { get; set; }
        public virtual User Seller { get; set; } = null!;

        [ForeignKey("Winner")]
        // Null khi chưa kết thúc hoặc phiên kết thúc mà không có bid.
        public int? WinnerId { get; set; }
        public virtual User? Winner { get; set; }

        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(500)]
        public string? CancellationReason { get; set; }

        // SQL Server tự đổi RowVersion sau mỗi UPDATE. EF so giá trị cũ trong
        // điều kiện UPDATE; không khớp thì báo DbUpdateConcurrencyException.
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
    }

    public enum ProductStatus
    {
        // Giá trị số đã lưu trong DB: không đổi thứ tự/giá trị nếu chưa migration.
        // Scheduled -> Active -> Completed; Admin có thể chuyển sang Cancelled.
        Active = 0,
        Completed = 1,
        Cancelled = 2,
        Scheduled = 3
    }
}
