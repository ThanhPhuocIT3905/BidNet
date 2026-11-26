using BidNet.Data;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Hubs;

// Hub riêng cho phòng đấu giá trực tiếp. Mỗi sự kiện là một nhóm;
// người xem không đăng nhập cũng theo dõi được nhưng không thể đặt giá.
[Authorize]
public class LiveAuctionHub(AppDbContext db, CurrentUser currentUser) : Hub
{
    public static string GroupName(int eventId) => $"live:{eventId}";

    public async Task JoinEvent(int eventId)
    {
        await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        if (!await db.LiveEvents.AnyAsync(e => e.Id == eventId, Context.ConnectionAborted))
            throw new HubException("Không tìm thấy sự kiện đấu giá trực tiếp.");
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(eventId));
    }

    public Task LeaveEvent(int eventId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(eventId));
}
