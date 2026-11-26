using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs
{

    // Không có Role/IsActive trong request; người đăng ký không tự cấp quyền Admin.
    public class UserRegisterDto
    {
        [Required(ErrorMessage = "Username không được để trống"), MinLength(3), MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email không được để trống"), EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu không được để trống"), MinLength(8), MaxLength(128)]
        public string Password { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? FullName { get; set; }

        [Phone, MaxLength(20)]
        public string? PhoneNumber { get; set; }
    }

    // Một ô nhập dùng được cả username lẫn email.
    public class UserLoginDto
    {
        [Required(ErrorMessage = "Username/Email không được để trống"), MaxLength(100)]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu không được để trống"), MaxLength(128)]
        public string Password { get; set; } = string.Empty;
    }

    // Chỉ sửa thông tin cá nhân; không cho client đổi role/trạng thái/số dư.
    public class ChangePasswordDto
    {
        [Required, MaxLength(128)]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu mới không được để trống"), MinLength(8), MaxLength(128)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UserUpdateProfileDto
    {
        public DateOnly? DateOfBirth { get; set; }
        [RegularExpression("^(Male|Female|Other|PreferNotToSay)?$")] public string? Gender { get; set; }
        [MaxLength(500)] public string? ContactAddress { get; set; }
        [MaxLength(200)]
        public string? FullName { get; set; }

        [Phone, MaxLength(20)]
        public string? PhoneNumber { get; set; }
    }

    public class UserResponseDto
    {
        public string? AvatarUrl { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? ContactAddress { get; set; }
        public DateTime? UpdatedAt { get; set; }
        // Không trả PasswordHash/PasswordSalt hoặc Balance ra response.
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // Sau login, client lưu AccessToken và gửi trong Authorization: Bearer <token>.
    public class AuthResponseDto
    {
        public string AccessToken { get; set; } = string.Empty;
        public UserResponseDto User { get; set; } = null!;
    }
}
