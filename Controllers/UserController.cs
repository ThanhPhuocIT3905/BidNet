using BidNet.Data;
using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/users/me")]
public class UserController(CurrentUser currentUser, AppDbContext db, IBidService bids) : ControllerBase
{
    // [Authorize] áp dụng cho cả controller. /me luôn lấy tài khoản từ token,
    // không nhận ID từ URL để tránh đọc/sửa hồ sơ người khác.
    [HttpGet]
    public async Task<ActionResult<UserResponseDto>> Me(CancellationToken ct) =>
        Ok(UserMapper.ToResponse(await currentUser.RequireActiveAsync(ct)));

    [HttpPut]
    // Chỉ cho đổi thông tin hồ sơ; role, trạng thái và mật khẩu không nằm trong DTO này.
    public async Task<ActionResult<UserResponseDto>> Update(
        UserUpdateProfileDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        user.FullName = request.FullName?.Trim();
        user.PhoneNumber = request.PhoneNumber?.Trim();
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(UserMapper.ToResponse(user));
    }

    [HttpGet("bids")]
    // BidService lọc theo UserId trong token, không cho chọn UserId tùy ý.
    public async Task<ActionResult<PagedResponseDto<BidResponseDto>>> MyBids(
        int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await bids.MineAsync(page, pageSize, ct));
}
