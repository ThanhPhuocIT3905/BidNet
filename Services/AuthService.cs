using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace BidNet.Services;

public class AuthService : IAuthService
{
    private readonly IAuthRepository _authRepo;
    private readonly IConfiguration _config;
    private const int PasswordIterations = 210_000;

    // Constructor chính cho Dependency Injection (sử dụng Repository Pattern)
    [ActivatorUtilitiesConstructor]
    public AuthService(IAuthRepository authRepo, IConfiguration config)
    {
        _authRepo = authRepo;
        _config = config;
    }

    // Constructor phụ hỗ trợ unit tests truyền trực tiếp AppDbContext
    public AuthService(AppDbContext db, IConfiguration config)
        : this(new AuthRepository(db), config)
    {
    }

    // Đăng ký chỉ cấp Role=User; Admin không thể tự tạo qua API công khai.
    public async Task<UserResponseDto> RegisterAsync(UserRegisterDto request, CancellationToken ct)
    {
        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        // Kiểm tra trước qua Repository để trả 409 dễ hiểu
        if (await _authRepo.ExistsByUsernameOrEmailAsync(username, email, ct))
            throw new ApiException(409, "account_exists", "Username hoặc email đã được sử dụng.");

        var salt = RandomNumberGenerator.GetBytes(16);
        var user = new User
        {
            Username = username,
            Email = email,
            FullName = request.FullName?.Trim(),
            PhoneNumber = request.PhoneNumber?.Trim(),
            PasswordSalt = salt,
            PasswordHash = HashPassword(request.Password, salt),
            Role = "User"
        };

        try
        {
            await _authRepo.AddUserAsync(user, ct);
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sql && sql.Number is 2601 or 2627)
        {
            // SQL 2601/2627 là trùng unique key/index: đổi thành lỗi API 409.
            throw new ApiException(409, "account_exists", "Username hoặc email đã được sử dụng.");
        }

        return UserMapper.ToResponse(user);
    }

    // Nhận username hoặc email, xác minh hash rồi mới phát JWT ngắn hạn.
    public async Task<AuthResponseDto> LoginAsync(UserLoginDto request, CancellationToken ct)
    {
        var login = request.UsernameOrEmail.Trim();
        var user = await _authRepo.GetByUsernameOrEmailAsync(login, ct);

        if (user is null || !VerifyPassword(request.Password, user.PasswordSalt, user.PasswordHash))
            throw new ApiException(401, "invalid_credentials", "Thông tin đăng nhập không hợp lệ.");

        if (!user.IsActive)
            throw new ApiException(403, "account_inactive", "Tài khoản đã bị khóa.");

        var tokenString = GenerateJwtToken(user);

        return new AuthResponseDto
        {
            AccessToken = tokenString,
            User = UserMapper.ToResponse(user)
        };
    }

    // Tạo JWT Token hỗ trợ cả cấu hình "JwtSettings" theo thầy và "Jwt" theo BidNet
    private string GenerateJwtToken(User user)
    {
        var key = _config["JwtSettings:SecretKey"] ?? _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Thiếu cấu hình Jwt:Key hoặc JwtSettings:SecretKey.");
        var issuer = _config["JwtSettings:Issuer"] ?? _config["Jwt:Issuer"];
        var audience = _config["JwtSettings:Audience"] ?? _config["Jwt:Audience"];
        var minutes = _config.GetValue<int>("JwtSettings:ExpiryMinutes", _config.GetValue<int>("Jwt:ExpireMinutes", 60));
        var now = DateTime.UtcNow;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role)  // 👈 Lấy Role từ Database (Admin hoặc User) đóng dấu vào 
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(minutes),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Xác minh mật khẩu: hỗ trợ cả PBKDF2 (chuẩn BidNet) và HMACSHA512 (chuẩn theo bài thầy)
    private static bool VerifyPassword(string password, byte[] salt, byte[] storedHash)
    {
        if (salt.Length == 16)
        {
            var computed = Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(storedHash, computed);
        }

        try
        {
            using var hmac = new HMACSHA512(salt);
            var computed = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
            return CryptographicOperations.FixedTimeEquals(storedHash, computed);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] HashPassword(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
}
