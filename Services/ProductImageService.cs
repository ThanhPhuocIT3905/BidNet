using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public interface IProductImageService
{
    Task<IReadOnlyList<ProductImageResponseDto>> ListForProductAsync(int productId, CancellationToken ct);
    Task<ProductImageResponseDto> UploadForProductAsync(int productId, IFormFile file, CancellationToken ct);
    Task<ProductImageResponseDto> AddUrlForProductAsync(int productId, AddProductImageUrlDto request, CancellationToken ct);
    Task DeleteAsync(int productId, int imageId, CancellationToken ct);
}

public class ProductImageService(
    AppDbContext db, CurrentUser currentUser, IFileService fileService) : IProductImageService
{
    public async Task<IReadOnlyList<ProductImageResponseDto>> ListForProductAsync(int productId, CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId, ct))
            throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");

        return await db.ProductImages.AsNoTracking()
            .Where(i => i.ProductId == productId)
            .OrderByDescending(i => i.UploadedAt).ThenByDescending(i => i.Id)
            .Select(i => new ProductImageResponseDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                FileName = i.FileName,
                ContentType = i.ContentType,
                Length = i.Length,
                Url = i.CloudinaryUrl,
                PublicId = i.CloudinaryPublicId,
                UploadedAt = i.UploadedAt
            })
            .ToListAsync(ct);
    }

    public async Task<ProductImageResponseDto> UploadForProductAsync(
        int productId, IFormFile file, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await RequireOwnerOrAdminAsync(productId, user, ct);

        var uploaded = await fileService.UploadFileAsync(file, ct);
        var url = $"/api/files/{uploaded.Id}";
        var extension = Path.GetExtension(uploaded.FileName).ToLowerInvariant();
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        var image = new ProductImage
        {
            ProductId = product.Id,
            FileName = uploaded.FileName,
            ContentType = contentType,
            Length = uploaded.Size,
            UploadedAt = uploaded.UploadedAt,
            CloudinaryPublicId = $"local/files/{uploaded.Id}",
            CloudinaryUrl = url
        };
        db.ProductImages.Add(image);

        if (string.IsNullOrWhiteSpace(product.ImageUrl))
        {
            product.ImageUrl = url;
            product.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return ToResponse(image);
    }

    public async Task<ProductImageResponseDto> AddUrlForProductAsync(
        int productId, AddProductImageUrlDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await RequireOwnerOrAdminAsync(productId, user, ct);

        var url = request.Url.Trim();
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new ApiException(400, "invalid_image_url", "URL ảnh phải dùng HTTP hoặc HTTPS.");

        var fileName = string.IsNullOrWhiteSpace(request.FileName)
            ? Path.GetFileName(uri.AbsolutePath)
            : request.FileName.Trim();
        if (string.IsNullOrWhiteSpace(fileName))
            fileName = $"product-{productId}-image";

        var image = new ProductImage
        {
            ProductId = product.Id,
            FileName = fileName.Length > 255 ? fileName[..255] : fileName,
            ContentType = "image/url",
            Length = 0,
            UploadedAt = DateTime.UtcNow,
            CloudinaryPublicId = request.PublicId?.Trim() ?? string.Empty,
            CloudinaryUrl = url
        };
        db.ProductImages.Add(image);

        if (string.IsNullOrWhiteSpace(product.ImageUrl))
        {
            product.ImageUrl = url;
            product.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return ToResponse(image);
    }

    public async Task DeleteAsync(int productId, int imageId, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await RequireOwnerOrAdminAsync(productId, user, ct);

        var image = await db.ProductImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == productId, ct)
            ?? throw new ApiException(404, "image_not_found", "Không tìm thấy ảnh sản phẩm.");

        db.ProductImages.Remove(image);
        if (string.Equals(product.ImageUrl, image.CloudinaryUrl, StringComparison.OrdinalIgnoreCase))
        {
            var nextUrl = await db.ProductImages.AsNoTracking()
                .Where(i => i.ProductId == productId && i.Id != imageId)
                .OrderByDescending(i => i.UploadedAt)
                .Select(i => i.CloudinaryUrl)
                .FirstOrDefaultAsync(ct);
            product.ImageUrl = nextUrl;
            product.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<Product> RequireOwnerOrAdminAsync(int productId, User user, CancellationToken ct)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var isAdmin = user.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        if (product.SellerId != user.Id && !isAdmin)
            throw new ApiException(403, "not_owner", "Chỉ người bán sản phẩm hoặc Admin mới được quản lý ảnh.");
        return product;
    }

    private static ProductImageResponseDto ToResponse(ProductImage i) => new()
    {
        Id = i.Id,
        ProductId = i.ProductId,
        FileName = i.FileName,
        ContentType = i.ContentType,
        Length = i.Length,
        Url = i.CloudinaryUrl,
        PublicId = i.CloudinaryPublicId,
        UploadedAt = i.UploadedAt
    };
}
