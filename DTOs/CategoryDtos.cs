using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class CreateCategoryDto
{
    [Required(ErrorMessage = "Tên danh mục không được để trống"), MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }
}

public class UpdateCategoryDto
{
    [Required(ErrorMessage = "Tên danh mục không được để trống"), MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }
}

public class CategoryResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int ProductCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
