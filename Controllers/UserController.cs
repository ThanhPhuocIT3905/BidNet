using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/users/me")]
public class UserController(IUserService users, IBidService bids) : ControllerBase
{
    // [Authorize] áp dụng cho cả controller. /me luôn lấy tài khoản từ token,
    // không nhận ID từ URL để tránh đọc/sửa hồ sơ người khác.
    // READ ONE (GET)
    [HttpGet]
    public async Task<ActionResult<UserResponseDto>> Me(CancellationToken ct) =>
        Ok(await users.GetProfileAsync(ct));

    // UPDATE (PUT)
    // Chỉ cho đổi thông tin hồ sơ; role, trạng thái và mật khẩu không nằm trong DTO này.
    [HttpPut]
    public async Task<ActionResult<UserResponseDto>> Update(
        UserUpdateProfileDto request, CancellationToken ct) =>
        Ok(await users.UpdateProfileAsync(request, ct));

    // READ ALL (GET)
    [HttpGet("bids")]
    // BidService lọc theo UserId trong token, không cho chọn UserId tùy ý.
    public async Task<ActionResult<PagedResponseDto<BidResponseDto>>> MyBids(
        int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await bids.MineAsync(page, pageSize, ct));
}
