using BidNet.Models;

namespace BidNet.Repositories
{
    // Hợp đồng truy cập bảng Users; quy tắc đăng nhập nằm ở AuthService.
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(int id);
        Task<User?> GetByEmailAsync(string email);
        Task<User?> GetByUsernameAsync(string username);
        Task AddAsync(User user);
        Task UpdateAsync(User user);
        Task DeleteAsync(int id);
    }
}
