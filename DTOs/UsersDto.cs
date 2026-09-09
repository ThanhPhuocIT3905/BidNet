using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs
{

    public class UserRegisterDto
    {
        [Required(ErrorMessage = "Username không được để trống"), MinLength(3), MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email không được để trống"), EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu không được để trống"), MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? FullName { get; set; }

        [Phone, MaxLength(20)]
        public string? PhoneNumber { get; set; }
    }

    public class UserLoginDto
    {
        [Required(ErrorMessage = "Username/Email không được để trống")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        public string Password { get; set; } = string.Empty;
    }

    public class UserUpdateProfileDto
    {
        [MaxLength(200)]
        public string? FullName { get; set; }

        [Phone, MaxLength(20)]
        public string? PhoneNumber { get; set; }
    }

    public class UserResponseDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
        public decimal Balance { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public UserResponseDto User { get; set; } = null!;
    }
}