using BidNet.DTOs;

namespace BidNet.Services;

// Controller phụ thuộc interface để phần xử lý tài khoản nằm ngoài tầng HTTP.
public interface IAuthService
{
    Task<UserResponseDto> RegisterAsync(UserRegisterDto request, CancellationToken ct);
    Task<AuthResponseDto> LoginAsync(UserLoginDto request, CancellationToken ct);
}
