using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet("won-products")]
    // Danh sách các phiên đấu giá mà người dùng này đã thắng cuộc
    public async Task<ActionResult<PagedResponseDto<ProductResponseDto>>> WonProducts(
        int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        var query = db.Products.AsNoTracking()
            .Include(p => p.Seller)
            .Include(p => p.Winner)
            .Where(p => p.WinnerId == user.Id && p.Status == ProductStatus.Completed);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(p => p.EndTime)
            .Skip((args.Page - 1) * args.PageSize)
            .Take(args.PageSize)
            .ToListAsync(ct);
        return Ok(new PagedResponseDto<ProductResponseDto>
        {
            Items = items.Select(ProductMapper.ToResponse).ToList(),
            Page = args.Page,
            PageSize = args.PageSize,
            TotalCount = total
        });
    }
}
