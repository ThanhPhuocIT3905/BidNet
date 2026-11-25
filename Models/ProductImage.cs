using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

public class ProductImage
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long Length { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public int? ProductId { get; set; }

    [ForeignKey(nameof(ProductId))]
    public virtual Product? Product { get; set; }

    [Required, MaxLength(500)]
    public string CloudinaryPublicId { get; set; } = string.Empty;

    [Required, MaxLength(1000)]
    public string CloudinaryUrl { get; set; } = string.Empty;
}
