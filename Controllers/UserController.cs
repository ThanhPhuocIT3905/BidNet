using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using BidNet.Data;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/users/me")]
public class UserController(IUserService users, IBidService bids, IAuthService auth, CurrentUser currentUser) : ControllerBase
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

    [HttpPut("password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        await auth.ChangePasswordAsync(user.Id, request, ct);
        return NoContent();
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<UserResponseDto>> Avatar(IFormFile file,
        [FromServices] CurrentUser currentUser, [FromServices] AppDbContext db,
        [FromServices] Cloudinary cloudinary, [FromServices] ILogger<UserController> logger, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        if (file is null || file.Length <= 0 || file.Length > 5 * 1024 * 1024)
            throw new ApiException(400, "invalid_avatar_size", "Ảnh phải có dung lượng từ 1 byte đến 5 MB.");
        await using var stream = file.OpenReadStream();
        var header = new byte[12];
        var count = await stream.ReadAtLeastAsync(header, header.Length, false, ct);
        var png = count >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10});
        var jpeg = count >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255;
        var webp = count == 12 && System.Text.Encoding.ASCII.GetString(header, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(header, 8, 4) == "WEBP";
        if (!png && !jpeg && !webp) throw new ApiException(400, "invalid_avatar_type", "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");
        await using var upload = file.OpenReadStream();
        ImageUploadResult image;
        try
        {
            image = await cloudinary.UploadAsync(new ImageUploadParams {
                File = new FileDescription(Path.GetFileName(file.FileName), upload),
                Folder = $"bidnet/avatars/{user.Id}",
                Transformation = new Transformation().Width(400).Height(400).Crop("fill").Gravity("auto").Quality("auto")
            }, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Avatar upload failed for user {UserId}", user.Id);
            throw new ApiException(502, "avatar_upload_failed", "Không tải được ảnh lên dịch vụ lưu trữ. Vui lòng thử lại.");
        }
        if (image.Error != null || image.SecureUrl == null)
            throw new ApiException(502, "avatar_upload_failed", "Không tải được ảnh lên dịch vụ lưu trữ. Vui lòng thử lại.");
        var oldId = user.AvatarPublicId;
        user.AvatarUrl = image.SecureUrl.ToString();
        user.AvatarPublicId = image.PublicId;
        user.UpdatedAt = DateTime.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch {
            await Cleanup(image.PublicId);
            throw;
        }
        if (!string.IsNullOrEmpty(oldId)) await Cleanup(oldId);
        return Ok(UserMapper.ToResponse(user));

        async Task Cleanup(string publicId) {
            try { var result = await cloudinary.DestroyAsync(new DeletionParams(publicId));
                if (result.Error != null) logger.LogWarning("Avatar cleanup failed for {PublicId}", publicId);
            } catch (Exception ex) { logger.LogWarning(ex, "Avatar cleanup failed for {PublicId}", publicId); }
        }
    }

    [HttpDelete("avatar")]
    public async Task<ActionResult<UserResponseDto>> RemoveAvatar(
        [FromServices] CurrentUser currentUser, [FromServices] AppDbContext db,
        [FromServices] Cloudinary cloudinary, [FromServices] ILogger<UserController> logger, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var publicId = user.AvatarPublicId;
        user.AvatarUrl = null;
        user.AvatarPublicId = null;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        if (!string.IsNullOrEmpty(publicId))
        {
            try
            {
                var result = await cloudinary.DestroyAsync(new DeletionParams(publicId));
                if (result.Error != null) logger.LogWarning("Avatar cleanup failed for {PublicId}", publicId);
            }
            catch (Exception ex) { logger.LogWarning(ex, "Avatar cleanup failed for {PublicId}", publicId); }
        }
        return Ok(UserMapper.ToResponse(user));
    }

    // READ ALL (GET)
    [HttpGet("bids")]
    // BidService lọc theo UserId trong token, không cho chọn UserId tùy ý.
    public async Task<ActionResult<PagedResponseDto<BidResponseDto>>> MyBids(
        int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await bids.MineAsync(page, pageSize, ct));
}
