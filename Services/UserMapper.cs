using BidNet.DTOs;
using BidNet.Models;

namespace BidNet.Services;

public static class UserMapper
{
    // Dùng chung cho auth, /me và Admin để cùng một cấu trúc response.
    // Chủ động bỏ hash/salt mật khẩu và số dư dù entity User có các trường đó.
    public static UserResponseDto ToResponse(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        Email = user.Email,
        FullName = user.FullName,
        PhoneNumber = user.PhoneNumber,
        Role = user.Role,
        IsActive = user.IsActive,
        CreatedAt = user.CreatedAt
    };
}
