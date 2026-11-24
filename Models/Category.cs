using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

// Bảng lưu danh mục sản phẩm (VD: Đồ điện tử, Đồng hồ, Xe cộ...)
// Thay thế cho việc gõ chuỗi Category thủ công, giúp chuẩn hóa dữ liệu.
[Table("Categories")]
public class Category
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Quan hệ 1 - Nhiều: Một danh mục chứa nhiều sản phẩm
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}
