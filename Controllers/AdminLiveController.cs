using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/live")]
public class AdminLiveController(LiveAuctionService live) : ControllerBase
{
    // Admin thấy cả sự kiện nháp; người dùng công khai không thấy.
    [HttpGet("events")]
    public async Task<ActionResult<List<LiveEventSummaryDto>>> Events(
        string? status, string? q, CancellationToken ct) =>
        Ok(await live.ListAsync(true, status, q, ct));

    [HttpPost("events")]
    public async Task<ActionResult<LiveEventDto>> Create(CreateLiveEventDto dto, CancellationToken ct) =>
        Ok(await live.CreateAsync(dto, ct));

    [HttpPut("events/{id:int}")]
    public async Task<ActionResult<LiveEventDto>> Update(int id, UpdateLiveEventDto dto, CancellationToken ct) =>
        Ok(await live.UpdateAsync(id, dto, ct));

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
        Ok(await live.AvailableProductsAsync(q, ct));
}
