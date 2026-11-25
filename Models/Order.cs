using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

public class Order
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProductId { get; set; }

    [ForeignKey(nameof(ProductId))]
    public virtual Product Product { get; set; } = null!;

    [Required]
    public int BuyerId { get; set; }

    [ForeignKey(nameof(BuyerId))]
    public virtual User Buyer { get; set; } = null!;

    [Required]
    public int SellerId { get; set; }

    [ForeignKey(nameof(SellerId))]
    public virtual User Seller { get; set; } = null!;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal FinalPrice { get; set; }

    [MaxLength(500)]
    public string? ShippingAddress { get; set; }

    [Required]
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public enum OrderStatus
{
    Pending = 0,
    Processing = 1,
    Shipped = 2,
    Completed = 3,
    Cancelled = 4
}
