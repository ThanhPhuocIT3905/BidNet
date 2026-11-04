using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

/// <summary>
/// Quản lý ảnh sản phẩm đấu giá (lưu trên Cloudinary CDN).
/// - POST   api/products/{productId}/images        → tải ảnh lên (chủ sản phẩm)
/// - GET    api/products/{productId}/images        → danh sách ảnh (công khai)
/// - GET    api/product-images/{id}               → xem ảnh - redirect Cloudinary (công khai)
/// - DELETE api/product-images/{id}               → xóa ảnh khỏi Cloudinary + DB (chủ sản phẩm)
/// </summary>
[ApiController]
public class ProductImagesController(IProductImageService imageService) : ControllerBase
{
    // ── Upload ảnh cho sản phẩm
    [Authorize]
    [HttpPost("api/products/{productId:int}/images")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ProductImageResponseDto>> Upload(
        int productId,
        [FromForm] UploadProductImageDto dto,
        CancellationToken ct)
    {
        var result = await imageService.UploadAsync(productId, dto.File, ct);
        return CreatedAtAction(nameof(GetImage), new { id = result.Id }, result);
    }

    // ── Danh sách ảnh của sản phẩm (công khai) 
    [HttpGet("api/products/{productId:int}/images")]
    public async Task<ActionResult<IEnumerable<ProductImageResponseDto>>> ListByProduct(
        int productId, CancellationToken ct) =>
        Ok(await imageService.GetByProductAsync(productId, ct));

    // ── Tải ảnh về máy theo ID (trả file nhị phân, Swagger sẽ hiện nút Download file) ──
    [HttpGet("api/product-images/{id:int}")]
    [Produces("application/octet-stream", "image/jpeg", "image/png")]
    public async Task<IActionResult> GetImage(int id, CancellationToken ct)
    {
        var file = await imageService.GetImageAsync(id, ct);
        // Trả trực tiếp file nhị phân kèm fileDownloadName y như code của thầy.
        // Swagger UI sẽ nhận diện và hiển thị link "Download file".
        return File(file.Content, file.ContentType, file.FileName);
    }

    // ── Xóa ảnh (chỉ chủ sản phẩm) 
    [Authorize]
    [HttpDelete("api/product-images/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await imageService.DeleteAsync(id, ct);
        return NoContent();
    }
}
