using System.Security.Claims;
using BidNet.Data;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class CurrentUser(IHttpContextAccessor accessor, AppDbContext db)
{
    // Dùng cho thao tác cần tài khoản đang hoạt động, kể cả khi JWT chưa hết hạn.
    public async Task<User> RequireActiveAsync(CancellationToken ct)
    {
        // ID từ claim là căn cứ chọn User; không nhận UserId do client gửi.
        // Đọc DB mỗi lần để tài khoản vừa bị khóa mất quyền ngay lập tức.
        var idClaim = accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idClaim, out var id))
            throw new ApiException(401, "unauthorized", "Cần đăng nhập.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null || !user.IsActive)
            throw new ApiException(403, "account_inactive", "Tài khoản không hoạt động.");
        return user;
    }
}
