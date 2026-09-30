using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Data.SqlClient;

namespace BidNet.Services;

public class AuthService(AppDbContext db, IConfiguration config) : IAuthService
{
    // Không lưu mật khẩu gốc. PBKDF2 + salt riêng làm cùng một mật khẩu
    // tạo hash khác nhau cho từng người; số vòng lặp làm đoán mật khẩu tốn công hơn.
    private const int PasswordIterations = 210_000;

    // Đăng ký chỉ cấp Role=User; Admin không thể tự tạo qua API công khai.
    public async Task<UserResponseDto> RegisterAsync(UserRegisterDto request, CancellationToken ct)
    {
        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        // Kiểm tra trước để trả 409 dễ hiểu. Vẫn cần unique index ở SQL Server
        // vì hai request có thể cùng vượt qua bước kiểm tra này.
        if (await db.Users.AnyAsync(u => u.Username == username || u.Email == email, ct))
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
        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync(ct);
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
        // Không tiết lộ username/email có tồn tại hay không qua thông báo lỗi.
        // FixedTimeEquals tránh so sánh hash dừng sớm theo byte đầu tiên khác.
        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Username == login || u.Email == login.ToLower(), ct);
        if (user is null || user.PasswordSalt.Length != 16 ||
            !CryptographicOperations.FixedTimeEquals(
                user.PasswordHash, HashPassword(request.Password, user.PasswordSalt)))
            throw new ApiException(401, "invalid_credentials", "Thông tin đăng nhập không hợp lệ.");
        if (!user.IsActive)
            throw new ApiException(403, "account_inactive", "Tài khoản đã bị khóa.");

        // Claim ID xác định người gọi, Role phục vụ [Authorize(Roles=...)].
        // Token không chứa mật khẩu; thay Role trong DB chỉ có hiệu lực với token mới.
        var key = config["Jwt:Key"] ?? throw new InvalidOperationException("Thiếu cấu hình Jwt:Key.");
        var now = DateTime.UtcNow;
        var minutes = config.GetValue<int>("Jwt:ExpireMinutes", 60);
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role)
            ],
            notBefore: now,
            expires: now.AddMinutes(minutes),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));
        return new AuthResponseDto
        {
            AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
            User = UserMapper.ToResponse(user)
        };
    }

    // Cùng password + salt + số vòng lặp luôn tạo lại đúng hash để so sánh lúc login.
    private static byte[] HashPassword(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
}
