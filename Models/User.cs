using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models
{
    public class User
    {
        // Entity ánh xạ bảng Users. Username/Email có unique index trong DbContext.
        [Key]
        public int Id { get; set; }

        [Required, MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        [MaxLength(200)]
        public string? FullName { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; } = 0; // Chưa dùng để trừ tiền/đặt cọc trong phiên bản này.

        // Chỉ lưu hash và salt; không có cột lưu mật khẩu gốc.
        public byte[] PasswordHash { get; set; } = Array.Empty<byte>();
        public byte[] PasswordSalt { get; set; } = Array.Empty<byte>();

        [Required, MaxLength(20)]
        public string Role { get; set; } = "User"; // "User", "Admin"

        // Khóa mềm: false ngăn đăng nhập và các thao tác cần CurrentUser.
        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties cho EF duyệt quan hệ, không phải cột ID riêng.
        public virtual ICollection<Product> ListedProducts { get; set; } = new List<Product>();
        public virtual ICollection<Product> WonProducts { get; set; } = new List<Product>();

        public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
    }
}
