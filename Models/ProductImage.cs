using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

// Entity lưu metadata ảnh sản phẩm; nội dung ảnh thật lưu trên Cloudinary.
[Table("ProductImages")]
public class ProductImage
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    // Kích thước file gốc (bytes) — chỉ để hiển thị thông tin.
    public long Length { get; set; }

    // Public ID do Cloudinary cấp; dùng để xóa ảnh khi cần.
    [Required, MaxLength(500)]
    public string CloudinaryPublicId { get; set; } = string.Empty;

    // URL trực tiếp trỏ đến ảnh trên CDN của Cloudinary.
    [Required, MaxLength(1000)]
    public string CloudinaryUrl { get; set; } = string.Empty;

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Liên kết tùy chọn với sản phẩm đấu giá (nullable → SetNull khi xóa Product).
    public int? ProductId { get; set; }
    [ForeignKey("ProductId")]
    public virtual Product? Product { get; set; }
}
