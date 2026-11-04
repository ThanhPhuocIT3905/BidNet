using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class ProductImageService(
    AppDbContext db,
    CurrentUser currentUser,
    Cloudinary cloudinary,
    IHttpClientFactory httpClientFactory) : IProductImageService
{
    // Chỉ chấp nhận các định dạng ảnh phổ biến; loại bỏ file giả mạo extension.
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif"
    };

    // Giới hạn 5 MB để tránh ngốn băng thông upload.
    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    public async Task<ProductImageResponseDto> UploadAsync(int productId, IFormFile file, CancellationToken ct)
    {
        // Xác thực người dùng đang đăng nhập và còn hoạt động.
        var user = await currentUser.RequireActiveAsync(ct);

        // Kiểm tra sản phẩm tồn tại.
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new ApiException(404, "PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại.");

        // Chỉ chủ sản phẩm mới được tải ảnh lên.
        if (product.SellerId != user.Id)
            throw new ApiException(403, "FORBIDDEN", "Bạn không có quyền tải ảnh cho sản phẩm này.");

        // Kiểm tra MIME type hợp lệ.
        if (!AllowedMimeTypes.Contains(file.ContentType))
            throw new ApiException(400, "INVALID_FILE_TYPE", "Chỉ chấp nhận ảnh định dạng JPEG, PNG, WebP hoặc GIF.");

        // Kiểm tra kích thước file.
        if (file.Length > MaxFileSizeBytes)
            throw new ApiException(400, "FILE_TOO_LARGE", "Kích thước ảnh không được vượt quá 5 MB.");

        if (file.Length == 0)
            throw new ApiException(400, "FILE_EMPTY", "File ảnh không được rỗng.");

        // Upload lên Cloudinary; lưu ảnh vào folder "bidnet/products/{productId}".
        ImageUploadResult uploadResult;
        await using (var stream = file.OpenReadStream())
        {
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = $"bidnet/products/{productId}",
                // Tự động tối ưu chất lượng và format khi phục vụ.
                Transformation = new Transformation().Quality("auto").FetchFormat("auto")
            };
            uploadResult = await cloudinary.UploadAsync(uploadParams, ct);
        }

        // Cloudinary trả lỗi khi StatusCode không phải 2xx.
        if (uploadResult.Error != null)
            throw new ApiException(502, "CLOUDINARY_ERROR", $"Upload thất bại: {uploadResult.Error.Message}");

        var image = new ProductImage
        {
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            Length = file.Length,
            CloudinaryPublicId = uploadResult.PublicId,
            CloudinaryUrl = uploadResult.SecureUrl.ToString(),
            UploadedAt = DateTime.UtcNow,
            ProductId = productId
        };

        db.ProductImages.Add(image);

        // Cập nhật ImageUrl của sản phẩm để trỏ đến ảnh Cloudinary mới nhất.
        product.ImageUrl = uploadResult.SecureUrl.ToString();
        product.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return MapToResponse(image);
    }

    public async Task<FileDownloadDto> GetImageAsync(int imageId, CancellationToken ct)
    {
        var image = await db.ProductImages.AsNoTracking()
            .FirstOrDefaultAsync(pi => pi.Id == imageId, ct)
            ?? throw new ApiException(404, "IMAGE_NOT_FOUND", "Ảnh không tồn tại.");

        // Tải nội dung nhị phân từ Cloudinary CDN để trả về file stream
        var client = httpClientFactory.CreateClient();
        var bytes = await client.GetByteArrayAsync(image.CloudinaryUrl, ct);

        return new FileDownloadDto
        {
            Content = bytes,
            ContentType = image.ContentType,
            FileName = image.FileName,
            RedirectUrl = image.CloudinaryUrl
        };
    }

    public async Task DeleteAsync(int imageId, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var image = await db.ProductImages
            .Include(pi => pi.Product)
            .FirstOrDefaultAsync(pi => pi.Id == imageId, ct)
            ?? throw new ApiException(404, "IMAGE_NOT_FOUND", "Ảnh không tồn tại.");

        // Chỉ chủ sản phẩm mới được xóa ảnh.
        if (image.Product == null || image.Product.SellerId != user.Id)
            throw new ApiException(403, "FORBIDDEN", "Bạn không có quyền xóa ảnh này.");

        // Xóa trên Cloudinary trước, sau đó xóa record trong DB.
        var deleteParams = new DeletionParams(image.CloudinaryPublicId);
        var deleteResult = await cloudinary.DestroyAsync(deleteParams);

        if (deleteResult.Error != null)
            throw new ApiException(502, "CLOUDINARY_ERROR", $"Xóa ảnh thất bại: {deleteResult.Error.Message}");

        db.ProductImages.Remove(image);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<ProductImageResponseDto>> GetByProductAsync(int productId, CancellationToken ct)
    {
        var exists = await db.Products.AnyAsync(p => p.Id == productId, ct);
        if (!exists)
            throw new ApiException(404, "PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại.");

        var images = await db.ProductImages.AsNoTracking()
            .Where(pi => pi.ProductId == productId)
            .OrderBy(pi => pi.UploadedAt)
            .ToListAsync(ct);

        return images.Select(MapToResponse);
    }

    private static ProductImageResponseDto MapToResponse(ProductImage image) => new()
    {
        Id = image.Id,
        FileName = image.FileName,
        ContentType = image.ContentType,
        Size = image.Length,
        // Trả trực tiếp URL Cloudinary CDN; client dùng URL này để hiển thị ảnh.
        Url = image.CloudinaryUrl,
        UploadedAt = image.UploadedAt
    };
}
