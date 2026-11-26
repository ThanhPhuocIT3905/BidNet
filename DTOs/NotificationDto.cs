namespace BidNet.DTOs;

// DTO trả về danh sách thông báo cho người dùng
public class NotificationResponseDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public int? ProductId { get; set; }
    public int? OrderId { get; set; }
    public int? TicketId { get; set; }
    public DateTime CreatedAt { get; set; }
}
