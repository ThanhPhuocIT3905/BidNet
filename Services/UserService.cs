using BidNet.DTOs;
using BidNet.DTOs.Common;
using BidNet.Models;
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

    public async Task<PagedResult<UserResponseDto>> GetAllAsync(UserQueryParameters queryParams)
    {
        var pagedUsers = await userRepo.GetAllAsync(queryParams);

        // Map danh sách Entity sang DTO
        var mappedItems = pagedUsers.Items.Select(MapToResponseDto).ToList();

        // Trả về PagedResult chứa DTO
        return new PagedResult<UserResponseDto>(
            mappedItems,
            pagedUsers.TotalCount,
            pagedUsers.PageNumber,
            pagedUsers.PageSize
        );
    }

    private static UserResponseDto MapToResponseDto(User u) => UserMapper.ToResponse(u);
}
