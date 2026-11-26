using BidNet.Data;
using BidNet.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Hubs;

public class AuctionHub(AppDbContext db, CurrentUser currentUser) : Hub
{
    // SignalR chia kết nối thành nhóm theo ProductId; sự kiện của phiên A
    // không bị phát đến người chỉ đang xem phiên B.
    public static string GroupName(int productId) => $"auction:{productId}";

    public override async Task OnConnectedAsync()
    {
        // Giá đấu là dữ liệu công khai; tài khoản đăng nhập vẫn phải còn hoạt động.
        if (Context.User?.Identity?.IsAuthenticated == true)
            await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        await base.OnConnectedAsync();
    }

    public async Task JoinProduct(int productId)
    {
        // Chỉ cho vào nhóm của sản phẩm tồn tại; xác thực thành viên nếu đã đăng nhập.
        if (Context.User?.Identity?.IsAuthenticated == true)
            await currentUser.RequireActiveAsync(Context.ConnectionAborted);
        if (!await db.Products.AnyAsync(p => p.Id == productId))
            throw new HubException("Không tìm thấy phiên đấu giá.");
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(productId));
    }

    // Rời nhóm chỉ ngừng nhận cập nhật; không ảnh hưởng dữ liệu phiên đấu giá.
    public Task LeaveProduct(int productId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(productId));
}
