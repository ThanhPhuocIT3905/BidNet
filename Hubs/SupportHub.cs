using BidNet.Data;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Hubs;

/// <summary>
/// Hub realtime cho BidNet Support – chat giữa người dùng và Admin.
/// Mỗi ticket có group riêng "support:{ticketId}"; Admin tham gia nhóm "admin-support"
/// để nhận thông báo khi có ticket mới hoặc tin nhắn mới.
/// </summary>
[Authorize]
public class SupportHub(AppDbContext db, CurrentUser currentUser) : Hub
{
    public static string TicketGroup(int ticketId) => $"support:{ticketId}";
    public const string AdminGroup = "admin-support";

    public override async Task OnConnectedAsync()
    {
        var user = await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        // Admin tham gia nhóm chung để nhận thông báo tất cả ticket.
        if (user.Role == "Admin")
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup);
        await base.OnConnectedAsync();
    }

    /// <summary>Tham gia nhóm của một ticket cụ thể để nhận tin nhắn realtime.</summary>
    public async Task JoinTicket(int ticketId)
    {
        var user = await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        var ticket = await db.SupportTickets.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == ticketId, Context.ConnectionAborted)
            ?? throw new HubException("Không tìm thấy ticket hỗ trợ.");
        // Chỉ người tạo ticket và Admin mới được vào nhóm.
        if (ticket.RequesterId != user.Id && user.Role != "Admin")
            throw new HubException("Bạn không có quyền truy cập ticket này.");
        await Groups.AddToGroupAsync(Context.ConnectionId, TicketGroup(ticketId));
    }

    public Task LeaveTicket(int ticketId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, TicketGroup(ticketId));

    /// <summary>Client gửi "đang nhập" để hiển thị typing indicator phía đối diện.</summary>
    public async Task TypingStarted(int ticketId)
    {
        var user = await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        await Clients.OthersInGroup(TicketGroup(ticketId))
            .SendAsync("TypingStarted", new { userId = user.Id, name = user.Username });
    }

    public async Task TypingStopped(int ticketId)
    {
        var user = await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        await Clients.OthersInGroup(TicketGroup(ticketId))
            .SendAsync("TypingStopped", new { userId = user.Id });
    }
}
