using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class UserStatusDto
{
    // Admin bật/tắt tài khoản mà không xóa lịch sử của người dùng.
    public bool IsActive { get; set; }
}

public class AdminUserUpdateDto
{
    // Các trường đều tùy chọn để Admin chỉ cần gửi thông tin muốn thay đổi.
    [MaxLength(50)]
    public string? Username { get; set; }

    [EmailAddress, MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? FullName { get; set; }

    [Phone, MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [MinLength(8)]
    public string? Password { get; set; }

    public string? Role { get; set; }
}

public class CancelProductDto
{
    // Lý do hủy được lưu cùng phiên đấu giá để dễ tra cứu.
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
