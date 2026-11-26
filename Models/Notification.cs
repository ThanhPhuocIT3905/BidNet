using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

// Bảng lưu thông báo cá nhân gửi tới người dùng:
// Ví dụ: "Giá của bạn đã bị vượt", "Bạn đã thắng phiên đấu giá...", "Có người vừa đặt giá mới".
[Table("Notifications")]
public class Notification
{
    [Key]
    public int Id { get; set; }

    // Người nhận thông báo
    public int UserId { get; set; }
    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(1000)]
    public string Message { get; set; } = string.Empty;

    // Trạng thái đã xem hay chưa
    public bool IsRead { get; set; } = false;
    public int? ProductId { get; set; }
    public int? OrderId { get; set; }
    public int? TicketId { get; set; }
    public SupportTicket? Ticket { get; set; }
    public Order? Order { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
