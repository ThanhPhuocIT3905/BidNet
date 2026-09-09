using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal StartingPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentPrice { get; set; } = 0;

        [Required]
        public DateTime StartTime { get; set; }

        [Required]
        public DateTime EndTime { get; set; }

        [Required]
        public ProductStatus Status { get; set; } = ProductStatus.Active;

        [ForeignKey("Seller")]
        public int SellerId { get; set; }
        public virtual User Seller { get; set; } = null!;

        [ForeignKey("Winner")]
        public int? WinnerId { get; set; }
        public virtual User? Winner { get; set; }

        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum ProductStatus
    {
        Active = 0,
        Completed = 1,
        Cancelled = 2
    }
}