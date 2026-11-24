using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

// DTO gửi lên khi tạo mới danh mục (Chỉ Admin)
public class CategoryCreateDto
{
    [Required(ErrorMessage = "Tên danh mục không được để trống.")]
    [MaxLength(100, ErrorMessage = "Tên danh mục tối đa 100 ký tự.")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "Mô tả tối đa 500 ký tự.")]
    public string? Description { get; set; }
}

// DTO gửi lên khi cập nhật danh mục
public class CategoryUpdateDto
{
    [Required(ErrorMessage = "Tên danh mục không được để trống.")]
    [MaxLength(100, ErrorMessage = "Tên danh mục tối đa 100 ký tự.")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "Mô tả tối đa 500 ký tự.")]
    public string? Description { get; set; }
}

// DTO trả về thông tin danh mục cho client
public class CategoryResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public int ProductCount { get; set; } // Số lượng sản phẩm trong danh mục này
}
