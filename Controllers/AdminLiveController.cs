using BidNet.DTOs;
using BidNet.Services;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/live")]
public class AdminLiveController(
    LiveAuctionService live,
    LiveAuctionRequestService requests,
    Cloudinary cloudinary,
    ILogger<AdminLiveController> logger) : ControllerBase
{
    // Admin thấy cả sự kiện nháp; người dùng công khai không thấy.
    [HttpGet("events")]
    public async Task<ActionResult<List<LiveEventSummaryDto>>> Events(
        string? status, string? q, CancellationToken ct) =>
        Ok(await live.ListAsync(true, status, q, ct));

    [HttpPost("events")]
    public async Task<ActionResult<LiveEventDto>> Create(CreateLiveEventDto dto, CancellationToken ct) =>
        Ok(await live.CreateAsync(dto, ct));

    [HttpGet("events/{id:int}")]
    public async Task<ActionResult<LiveEventDto>> Get(int id, CancellationToken ct) =>
        Ok(await live.GetAsync(id, ct));

    [HttpPut("events/{id:int}")]
    public async Task<ActionResult<LiveEventDto>> Update(int id, UpdateLiveEventDto dto, CancellationToken ct) =>
        Ok(await live.UpdateAsync(id, dto, ct));

    [HttpPost("banners")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<object>> UploadBanner([FromForm] IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length <= 0 || file.Length > 5 * 1024 * 1024)
            throw new ApiException(400, "invalid_banner_size", "Ảnh phải có dung lượng từ 1 byte đến 5 MB.");

        await using var stream = file.OpenReadStream();
        var header = new byte[12];
        var count = await stream.ReadAtLeastAsync(header, header.Length, false, ct);
        var png = count >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = count >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255;
        var webp = count == 12 &&
            System.Text.Encoding.ASCII.GetString(header, 0, 4) == "RIFF" &&
            System.Text.Encoding.ASCII.GetString(header, 8, 4) == "WEBP";
        if (!png && !jpeg && !webp)
            throw new ApiException(400, "invalid_banner_type", "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");

        await using var upload = file.OpenReadStream();
        ImageUploadResult image;
        try
        {
            image = await cloudinary.UploadAsync(new ImageUploadParams
            {
                File = new FileDescription(Path.GetFileName(file.FileName), upload),
                Folder = "bidnet/live-banners",
                Transformation = new Transformation().Width(1800).Height(700).Crop("fill").Quality("auto")
            }, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Live event banner upload failed");
            throw new ApiException(502, "banner_upload_failed", "Không tải được banner lên dịch vụ lưu trữ. Vui lòng thử lại.");
        }

        if (image.Error != null || image.SecureUrl == null)
            throw new ApiException(502, "banner_upload_failed", "Không tải được banner lên dịch vụ lưu trữ. Vui lòng thử lại.");

        return Ok(new { bannerUrl = image.SecureUrl.ToString() });
    }

    [HttpPost("events/{id:int}/publish")]
    public async Task<ActionResult<LiveEventDto>> Publish(int id, CancellationToken ct) =>
        Ok(await live.PublishAsync(id, ct));

    [HttpPost("events/{id:int}/lots")]
    public async Task<ActionResult<LiveLotDto>> AddLot(int id, AddLiveLotDto dto, CancellationToken ct) =>
        Ok(await live.AddLotAsync(id, dto, ct));

    [HttpDelete("lots/{lotId:int}")]
    public async Task<IActionResult> RemoveLot(int lotId, CancellationToken ct)
    {
        await live.RemoveLotAsync(lotId, ct);
        return NoContent();
    }

    [HttpPost("lots/{lotId:int}/open")]
    public async Task<ActionResult<LiveSnapshotDto>> Open(int lotId, CancellationToken ct) =>
        Ok(await live.StartLotAsync(lotId, ct));

    [HttpPost("lots/{lotId:int}/warning")]
    public async Task<ActionResult<LiveSnapshotDto>> Warning(int lotId, CancellationToken ct) =>
        Ok(await live.WarnAsync(lotId, ct));

    [HttpPost("lots/{lotId:int}/close")]
    public async Task<ActionResult<LiveSnapshotDto>> Close(
        int lotId, [FromQuery] bool forceUnsold, CancellationToken ct) =>
        Ok(await live.CloseLotAsync(lotId, forceUnsold, ct));

    [HttpPost("lots/{lotId:int}/skip")]
    public async Task<IActionResult> Skip(int lotId, CancellationToken ct)
    {
        await live.SkipLotAsync(lotId, ct);
        return NoContent();
    }

    [HttpPost("events/{id:int}/pause")]
    public async Task<ActionResult<LiveSnapshotDto>> Pause(int id, CancellationToken ct) =>
        Ok(await live.PauseAsync(id, false, ct));

    [HttpPost("events/{id:int}/resume")]
    public async Task<ActionResult<LiveSnapshotDto>> Resume(int id, CancellationToken ct) =>
        Ok(await live.PauseAsync(id, true, ct));

    [HttpPost("events/{id:int}/complete")]
    public async Task<ActionResult<LiveSnapshotDto>> Complete(int id, CancellationToken ct) =>
        Ok(await live.CompleteAsync(id, ct));

    [HttpPost("events/{id:int}/announcement")]
    public async Task<IActionResult> Announcement(int id, LiveAnnouncementDto dto, CancellationToken ct)
    {
        await live.AnnounceAsync(id, dto.Message, ct);
        return NoContent();
    }

    [HttpGet("events/{id:int}/registrations")]
    public async Task<ActionResult<List<LiveRegistrationDto>>> Registrations(int id, CancellationToken ct) =>
        Ok(await live.RegistrationsAsync(id, ct));

    [HttpGet("products")]
    public async Task<ActionResult<List<LiveProductOptionDto>>> Products(string? q, CancellationToken ct) =>
        Ok(await requests.InventoryAsync(q, ct));
}
