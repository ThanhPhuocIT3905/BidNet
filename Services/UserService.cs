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
        if (request.DateOfBirth is { } dob)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (dob > today)
                throw new ApiException(400, "invalid_birth_date", "Ngày sinh không được ở tương lai.");
            if (dob > today.AddYears(-18))
                throw new ApiException(400, "age_restriction", "Bạn phải đủ 18 tuổi để tham gia đấu giá.");
        }
        user.DateOfBirth = request.DateOfBirth;
        user.Gender = string.IsNullOrWhiteSpace(request.Gender) ? null : request.Gender;
        user.ContactAddress = string.IsNullOrWhiteSpace(request.ContactAddress) ? null : request.ContactAddress.Trim();
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
