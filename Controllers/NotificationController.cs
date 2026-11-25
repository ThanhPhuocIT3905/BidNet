using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationController(INotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResponseDto<NotificationResponseDto>>> Mine(
        bool unreadOnly = false, int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await notifications.MineAsync(unreadOnly, page, pageSize, ct));

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountDto>> UnreadCount(CancellationToken ct) =>
        Ok(await notifications.UnreadCountAsync(ct));

    [HttpPatch("{id:int}/read")]
    public async Task<ActionResult<NotificationResponseDto>> MarkAsRead(int id, CancellationToken ct) =>
        Ok(await notifications.MarkAsReadAsync(id, ct));

    [HttpPatch("read-all")]
    public async Task<ActionResult<object>> MarkAllAsRead(CancellationToken ct)
    {
        var updated = await notifications.MarkAllAsReadAsync(ct);
        return Ok(new { updatedCount = updated });
    }
}
