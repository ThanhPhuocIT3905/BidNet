using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class UserStatusDto
{
    // Admin bật/tắt tài khoản mà không xóa lịch sử của người dùng.
    public bool IsActive { get; set; }
}

public class CancelProductDto
{
    // Lý do hủy được lưu cùng phiên đấu giá để dễ tra cứu.
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
