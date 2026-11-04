using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace BidNet.DTOs;

public class UploadProductImageDto
{
    [Required(ErrorMessage = "Vui lòng chọn file ảnh để tải lên.")]
    public IFormFile File { get; set; } = null!;
}

public class ProductImageResponseDto
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    // URL trực tiếp trên CDN Cloudinary; dùng thẳng trong <img src="..."> để hiển thị.
    public string Url { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
}

public class FileDownloadDto
{
    public byte[] Content { get; set; } = Array.Empty<byte>();
    public string ContentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? RedirectUrl { get; set; }
}
