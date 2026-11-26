using System.ComponentModel.DataAnnotations;

namespace BidNet.Models;

// Append-only business history, written in the same transaction as the order change.
public class OrderEvent
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int? ActorId { get; set; }
    public User? Actor { get; set; }
    [MaxLength(40)] public string Action { get; set; } = string.Empty;
    public OrderStatus? FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    [MaxLength(500)] public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
