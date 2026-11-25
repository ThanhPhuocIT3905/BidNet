using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/files")]
public class FilesController(IFileService fileService) : ControllerBase
{
    [HttpPost("upload")]
    [EnableRateLimiting("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(FileService.MaximumFileSizeBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = FileService.MaximumFileSizeBytes + 64 * 1024)]
    [ProducesResponseType<FileResponseDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<ActionResult<FileResponseDto>> Upload(
        [FromForm] UploadFileDto dto,
        CancellationToken cancellationToken)
    {
        var result = await fileService.UploadFileAsync(dto.File, cancellationToken);
        return CreatedAtAction(nameof(Download), new { id = result.Id }, result);
    }

    // Cho phép truy cập công khai để trình duyệt/Frontend hiển thị trực tiếp bằng thẻ <img>.
    [AllowAnonymous]
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(int id, CancellationToken cancellationToken)
    {
        var fileDto = await fileService.GetFileForDownloadAsync(id, cancellationToken)
            ?? throw new ApiException(404, "file_not_found", "Không tìm thấy file yêu cầu.");

        return File(fileDto.Content, fileDto.ContentType, fileDto.FileName);
    }
}
