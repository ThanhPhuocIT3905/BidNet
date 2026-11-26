using BidNet.Data;
using BidNet.DTOs;
using BidNet.Exceptions;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Controllers;

[ApiController]
[Authorize] // Bắt buộc đăng nhập
[Route("api/[controller]")]
public class NotificationsController(AppDbContext db, CurrentUser currentUser) : ControllerBase
{
    // READ ME: Lấy toàn bộ thông báo của người dùng hiện tại
    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<NotificationResponseDto>>> GetMyNotifications(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var notifications = await db.Notifications.AsNoTracking()
            .Where(n => n.UserId == user.Id)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationResponseDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                ProductId = n.ProductId,
                OrderId = n.OrderId,
                TicketId = n.TicketId,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(notifications);
    }

    // UPDATE: Đánh dấu một thông báo đã đọc
    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkAsRead(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == user.Id, ct);
        if (notification == null)
            throw new NotFoundException($"Không tìm thấy thông báo ID {id}.");

        notification.IsRead = true;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    // UPDATE ALL: Đánh dấu toàn bộ thông báo của mình là đã đọc
    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var unreadNotifications = await db.Notifications
            .Where(n => n.UserId == user.Id && !n.IsRead)
            .ToListAsync(ct);

        foreach (var item in unreadNotifications)
        {
            item.IsRead = true;
        }

        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
