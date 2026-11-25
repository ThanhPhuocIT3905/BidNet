using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class ProductImageResponseDto
{
    public int Id { get; set; }
    public int? ProductId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Length { get; set; }
    public string Url { get; set; } = string.Empty;
    public string PublicId { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
}

public class AddProductImageUrlDto
{
    [Required(ErrorMessage = "URL ảnh không được để trống"), MaxLength(1000)]
    public string Url { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? FileName { get; set; }

    [MaxLength(500)]
    public string? PublicId { get; set; }
}
