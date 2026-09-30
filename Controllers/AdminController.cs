using BidNet.Data;
using BidNet.DTOs;
using BidNet.Hubs;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin")]
// JWT phải có role Admin. Mỗi action còn đọc DB để từ chối tài khoản vừa bị khóa.
public class AdminController(
    AppDbContext db, CurrentUser currentUser, IHubContext<AuctionHub> hub,
    ILogger<AdminController> logger) : ControllerBase
{
    [HttpGet("users")]
    // Dùng AsNoTracking vì chỉ hiển thị; phân trang để không trả toàn bộ user.
    public async Task<ActionResult<PagedResponseDto<UserResponseDto>>> Users(
        int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        var count = await db.Users.CountAsync(ct);
        var users = await db.Users.AsNoTracking().OrderBy(u => u.Id)
            .Skip((args.Page - 1) * args.PageSize).Take(args.PageSize).ToListAsync(ct);
        return Ok(new PagedResponseDto<UserResponseDto>
        {
            Items = users.Select(UserMapper.ToResponse).ToList(),
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = count
        });
    }

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

    [HttpPut("users/{id:int}")]
    public async Task<ActionResult<UserResponseDto>> UpdateUser(
        int id, AdminUserUpdateDto request, CancellationToken ct)
    {
        var admin = await currentUser.RequireActiveAsync(ct);
        var user = await db.Users.FindAsync([id], ct)
            ?? throw new ApiException(404, "user_not_found", "Không tìm thấy tài khoản.");

        var username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim();
        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant();
        var role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();

        if (username is not null && await db.Users.AnyAsync(u => u.Id != id && u.Username == username, ct) ||
            email is not null && await db.Users.AnyAsync(u => u.Id != id && u.Email == email, ct))
            throw new ApiException(409, "account_exists", "Username hoặc email đã được sử dụng.");

        if (role is not null)
        {
            if (!role.Equals("User", StringComparison.OrdinalIgnoreCase) &&
                !role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
                throw new ApiException(400, "invalid_role", "Role chỉ được là User hoặc Admin.");
            if (admin.Id == id && role.Equals("User", StringComparison.OrdinalIgnoreCase))
                throw new ApiException(400, "cannot_demote_self", "Không thể tự hạ quyền Admin của mình.");
            user.Role = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User";
        }

        if (username is not null) user.Username = username;
        if (email is not null) user.Email = email;
        if (request.FullName is not null) user.FullName = request.FullName.Trim();
        if (request.PhoneNumber is not null) user.PhoneNumber = request.PhoneNumber.Trim();
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var (passwordHash, passwordSalt) = PasswordHasher.Create(request.Password);
            user.PasswordHash = passwordHash;
            user.PasswordSalt = passwordSalt;
        }
        user.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sql && sql.Number is 2601 or 2627)
        {
            throw new ApiException(409, "account_exists", "Username hoặc email đã được sử dụng.");
        }

        return Ok(UserMapper.ToResponse(user));
    }

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
