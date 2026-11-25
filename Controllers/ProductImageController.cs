using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BidNet.Controllers;

[ApiController]
[Route("api/products/{productId:int}/images")]
public class ProductImageController(IProductImageService images) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductImageResponseDto>>> List(
        int productId, CancellationToken ct) =>
        Ok(await images.ListForProductAsync(productId, ct));

    [Authorize]
    [HttpPost("upload")]
    [EnableRateLimiting("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(FileService.MaximumFileSizeBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = FileService.MaximumFileSizeBytes + 64 * 1024)]
    public async Task<ActionResult<ProductImageResponseDto>> Upload(
        int productId, [FromForm] UploadFileDto dto, CancellationToken ct)
    {
        var result = await images.UploadForProductAsync(productId, dto.File, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [Authorize]
    [HttpPost("url")]
    public async Task<ActionResult<ProductImageResponseDto>> AddUrl(
        int productId, AddProductImageUrlDto request, CancellationToken ct)
    {
        var result = await images.AddUrlForProductAsync(productId, request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [Authorize]
    [HttpDelete("{imageId:int}")]
    public async Task<IActionResult> Delete(int productId, int imageId, CancellationToken ct)
    {
        await images.DeleteAsync(productId, imageId, ct);
        return NoContent();
    }
}
