using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public interface INotificationService
{
    Task<PagedResponseDto<NotificationResponseDto>> MineAsync(
        bool unreadOnly, int page, int pageSize, CancellationToken ct);
    Task<UnreadCountDto> UnreadCountAsync(CancellationToken ct);
    Task<NotificationResponseDto> MarkAsReadAsync(int id, CancellationToken ct);
    Task<int> MarkAllAsReadAsync(CancellationToken ct);
}

public class NotificationService(AppDbContext db, CurrentUser currentUser) : INotificationService
{
    public async Task<PagedResponseDto<NotificationResponseDto>> MineAsync(
        bool unreadOnly, int page, int pageSize, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);

        var query = db.Notifications.AsNoTracking().Where(n => n.UserId == user.Id);
        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize)
            .Select(n => new NotificationResponseDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(ct);

        return new PagedResponseDto<NotificationResponseDto>
        {
            Items = items,
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = total
        };
    }

    public async Task<UnreadCountDto> UnreadCountAsync(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var count = await db.Notifications.CountAsync(n => n.UserId == user.Id && !n.IsRead, ct);
        return new UnreadCountDto { UnreadCount = count };
    }

    public async Task<NotificationResponseDto> MarkAsReadAsync(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id, ct)
            ?? throw new ApiException(404, "notification_not_found", "Không tìm thấy thông báo.");
        if (notification.UserId != user.Id)
            throw new ApiException(403, "forbidden", "Bạn không có quyền thao tác thông báo này.");

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await db.SaveChangesAsync(ct);
        }

        return new NotificationResponseDto
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Title = notification.Title,
            Message = notification.Message,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt
        };
    }

    public async Task<int> MarkAllAsReadAsync(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var unread = await db.Notifications
            .Where(n => n.UserId == user.Id && !n.IsRead)
            .ToListAsync(ct);
        foreach (var item in unread)
            item.IsRead = true;
        if (unread.Count > 0)
            await db.SaveChangesAsync(ct);
        return unread.Count;
    }
}
