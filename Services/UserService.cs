using BidNet.DTOs;
using BidNet.Repositories;

namespace BidNet.Services;

public class UserService(CurrentUser currentUser, IUserRepository userRepo) : IUserService
{
    public async Task<UserResponseDto> GetProfileAsync(CancellationToken ct = default)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        return UserMapper.ToResponse(user);
    }

    public async Task<UserResponseDto> UpdateProfileAsync(UserUpdateProfileDto request, CancellationToken ct = default)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        user.FullName = request.FullName?.Trim();
        user.PhoneNumber = request.PhoneNumber?.Trim();
        user.UpdatedAt = DateTime.UtcNow;
        await userRepo.UpdateAsync(user);
        return UserMapper.ToResponse(user);
    }

    public async Task<UserResponseDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var user = await userRepo.GetByIdAsync(id);
        return user is null ? null : UserMapper.ToResponse(user);
    }
}
