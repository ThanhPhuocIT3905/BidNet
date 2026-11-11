using BidNet.DTOs;
using BidNet.DTOs.Common;

namespace BidNet.Services;

// Hợp đồng nghiệp vụ người dùng: xem và cập nhật hồ sơ cá nhân, danh sách phân trang người dùng.
public interface IUserService
{
    Task<UserResponseDto> GetProfileAsync(CancellationToken ct = default);
    Task<UserResponseDto> UpdateProfileAsync(UserUpdateProfileDto request, CancellationToken ct = default);
    Task<UserResponseDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PagedResult<UserResponseDto>> GetAllAsync(UserQueryParameters queryParams);
}
