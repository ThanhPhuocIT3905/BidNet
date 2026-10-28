using BidNet.Data;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Repositories;

public class AuthRepository : IAuthRepository
{
    private readonly AppDbContext _context;

    public AuthRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Username == username);
    }

    public async Task<User?> GetByUsernameOrEmailAsync(string usernameOrEmail, CancellationToken ct = default)
    {
        var login = usernameOrEmail.Trim();
        var lower = login.ToLowerInvariant();
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Username == login || u.Email == lower, ct);
    }

    public async Task<bool> ExistsByUsernameOrEmailAsync(string username, string email, CancellationToken ct = default)
    {
        return await _context.Users
            .AnyAsync(u => u.Username == username || u.Email == email, ct);
    }

    public async Task AddUserAsync(User user, CancellationToken ct = default)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);
    }
}
