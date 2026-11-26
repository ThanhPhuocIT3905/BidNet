using BidNet.Data;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Hubs;

// Hub riêng cho phòng đấu giá trực tiếp và danh mục sự kiện trên trang chủ.
public class LiveAuctionHub(
    AppDbContext db,
    CurrentUser currentUser,
    LiveViewerTracker viewers) : Hub
{
    public static string GroupName(int eventId) => $"live:{eventId}";
    public const string LobbyGroupName = "live:lobby";

    public Task JoinLobby() =>
        Groups.AddToGroupAsync(Context.ConnectionId, LobbyGroupName);

    public async Task<int> JoinEvent(int eventId)
    {
        if (Context.User?.Identity?.IsAuthenticated == true)
            await currentUser.RequireActiveAsync(Context.ConnectionAborted);

        if (!await db.LiveEvents.AnyAsync(e => e.Id == eventId && e.Status != LiveEventStatus.Draft, Context.ConnectionAborted))
            throw new HubException("Không tìm thấy sự kiện đấu giá trực tiếp.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(eventId));
        var count = viewers.Join(eventId, Context.ConnectionId);
        await Clients.Group(GroupName(eventId)).SendAsync("ViewerCountUpdated", new { eventId, viewerCount = count });
        await Clients.Group(LobbyGroupName).SendAsync("LiveCatalogChanged", new { eventId, change = "ViewerCountUpdated" });
        return count;
    }

    public async Task LeaveEvent(int eventId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(eventId));
        var count = viewers.Leave(eventId, Context.ConnectionId);
        await Clients.Group(GroupName(eventId)).SendAsync("ViewerCountUpdated", new { eventId, viewerCount = count });
        await Clients.Group(LobbyGroupName).SendAsync("LiveCatalogChanged", new { eventId, change = "ViewerCountUpdated" });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var (eventId, count) in viewers.LeaveAll(Context.ConnectionId))
        {
            await Clients.Group(GroupName(eventId)).SendAsync("ViewerCountUpdated", new { eventId, viewerCount = count });
            await Clients.Group(LobbyGroupName).SendAsync("LiveCatalogChanged", new { eventId, change = "ViewerCountUpdated" });
        }

        await base.OnDisconnectedAsync(exception);
    }
}
