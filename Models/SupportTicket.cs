using System.ComponentModel.DataAnnotations;

namespace BidNet.Models;

public enum TicketStatus { Open = 0, InProgress = 1, Resolved = 2 }

public class SupportTicket
{
    public int Id { get; set; }
    public int RequesterId { get; set; }
    public User Requester { get; set; } = null!;
    [MaxLength(160)] public string Subject { get; set; } = string.Empty;
    public int? ProductId { get; set; }
    public Product? Product { get; set; }
    public int? OrderId { get; set; }
    public Order? Order { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.Open;
    /// <summary>Trang người dùng đang xem khi mở chat: home, product, order, my-products, v.v.</summary>
    [MaxLength(50)] public string? PageContext { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    [Timestamp] public byte[] RowVersion { get; set; } = [];
    public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
}

public class SupportMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public SupportTicket Ticket { get; set; } = null!;
    public int AuthorId { get; set; }
    public User Author { get; set; } = null!;
    [MaxLength(2000)] public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

