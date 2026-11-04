using BidNet.DTOs;

namespace BidNet.Services;

/// <summary>
/// Giao diện dịch vụ quản lý ảnh sản phẩm đấu giá.
/// </summary>
public interface IProductImageService
{
    /// <summary>Tải ảnh lên và liên kết với sản phẩm.</summary>
    Task<ProductImageResponseDto> UploadAsync(int productId, IFormFile file, CancellationToken ct);

    /// <summary>Lấy thông tin ảnh (URL Cloudinary) để redirect về cho client.</summary>
    Task<FileDownloadDto> GetImageAsync(int imageId, CancellationToken ct);

    /// <summary>Xóa ảnh (chỉ chủ sản phẩm mới được xóa).</summary>
    Task DeleteAsync(int imageId, CancellationToken ct);

    /// <summary>Lấy danh sách ảnh của một sản phẩm.</summary>
    Task<IEnumerable<ProductImageResponseDto>> GetByProductAsync(int productId, CancellationToken ct);
}
