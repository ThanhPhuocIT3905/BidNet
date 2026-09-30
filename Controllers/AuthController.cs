using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BidNet.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth) : ControllerBase
{
    // Controller chỉ chuyển request sang service. [ApiController] tự kiểm
    // DataAnnotations của DTO và trả 400 nếu body không hợp lệ.
    [HttpPost("register")]
    // Cùng policy với login để hạn chế tạo tài khoản hàng loạt.
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<UserResponseDto>> Register(UserRegisterDto request, CancellationToken ct)
    {
        var user = await auth.RegisterAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    // Đăng nhập trả JWT cho các route có [Authorize]; không tạo session trên server.
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> Login(UserLoginDto request, CancellationToken ct) =>
        Ok(await auth.LoginAsync(request, ct));
}
