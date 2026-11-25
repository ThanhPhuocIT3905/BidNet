using BidNet.Data;
using BidNet.DTOs;
using BidNet.DTOs.Common;
using BidNet.Hubs;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Controllers;

[ApiController]
[Authorize(Roles = "Admin")] // KHÔNG CHO ROLE USER VÀO!
[Route("api/admin")]
// JWT phải có role Admin. Mỗi action còn đọc DB để từ chối tài khoản vừa bị khóa.
public class AdminController(
    AppDbContext db,
    CurrentUser currentUser,
    IUserService userService,
    IHubContext<AuctionHub> hub,
    ILogger<AdminController> logger) : ControllerBase
{
    // READ ALL (GET) kèm Phân trang, Tìm kiếm, Lọc và Sắp xếp qua IUserService.GetAllAsync
    [HttpGet("users")]
    public async Task<ActionResult<PagedResult<UserResponseDto>>> Users(
        [FromQuery] UserQueryParameters queryParams, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var result = await userService.GetAllAsync(queryParams);
        return Ok(result);
    }

    // UPDATE / PARTIAL UPDATE (PATCH)
    [HttpPatch("users/{id:int}/status")]
    public async Task<ActionResult<UserResponseDto>> SetUserStatus(
        int id, UserStatusDto request, CancellationToken ct)
    {
        // Khóa mềm (IsActive=false) giữ lịch sử; cấm tự khóa để Admin còn
        // tài khoản đang đăng nhập xử lý hệ thống.
        var admin = await currentUser.RequireActiveAsync(ct);
        if (admin.Id == id && !request.IsActive)
            throw new ApiException(400, "cannot_disable_self", "Không thể tự khóa tài khoản Admin.");
        var user = await db.Users.FindAsync([id], ct)
            ?? throw new ApiException(404, "user_not_found", "Không tìm thấy tài khoản.");
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(UserMapper.ToResponse(user));
    }

    // UPDATE / PARTIAL UPDATE (PATCH)
    [HttpPatch("products/{id:int}/cancel")]
    public async Task<ActionResult<ProductResponseDto>> Cancel(
        int id, CancelProductDto request, CancellationToken ct)
    {
        // Hủy mềm thay trạng thái thay vì xóa sản phẩm/bid. Phiên đã kết thúc
        // hoặc đã hủy không được xử lý lại.
        await currentUser.RequireActiveAsync(ct);
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ApiException(400, "invalid_reason", "Cần ghi lý do hủy phiên.");
        var product = await db.Products.Include(p => p.Seller).Include(p => p.Winner)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        if (product.Status is ProductStatus.Completed or ProductStatus.Cancelled)
            throw new ApiException(409, "auction_closed", "Phiên đã kết thúc hoặc đã hủy.");
        product.Status = ProductStatus.Cancelled;
        product.CancellationReason = request.Reason.Trim();
        product.UpdatedAt = DateTime.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            // RowVersion chặn ghi đè nếu worker/bid khác vừa đổi phiên.
            throw new ApiException(409, "product_changed", "Phiên đã thay đổi, hãy tải lại.");
        }
        try
        {
            // Gửi sự kiện sau SaveChanges để client chỉ thấy trạng thái đã lưu.
            await hub.Clients.Group(AuctionHub.GroupName(id))
                .SendAsync("AuctionClosed", new { productId = id, status = "Cancelled" }, ct);
        }
        catch (Exception ex)
        {
            // Hủy trong DB vẫn thành công dù thông báo realtime bị lỗi.           
            logger.LogWarning(ex, "Không gửi được AuctionClosed cho phiên {ProductId}", id);
        }
        return Ok(ProductMapper.ToResponse(product));
    }
}
