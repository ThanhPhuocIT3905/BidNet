using BidNet.Models;

namespace BidNet.Repositories;

public interface IAuthRepository
{
    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByUsernameOrEmailAsync(string usernameOrEmail, CancellationToken ct = default);
    Task<bool> ExistsByUsernameOrEmailAsync(string username, string email, CancellationToken ct = default);
    Task AddUserAsync(User user, CancellationToken ct = default);
}
