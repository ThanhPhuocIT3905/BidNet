using BidNet.Data;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BidNet.Repositories
{
    public class UserRepository : IUserRepository
    {
        // Repository gom thao tác lưu User; service giữ phần quy tắc nghiệp vụ.
        private readonly AppDbContext _ctx;
        public UserRepository(AppDbContext ctx) => _ctx = ctx;

        public async Task<User?> GetByIdAsync(int id) =>
            await _ctx.Users.FindAsync(id);

        public async Task<User?> GetByEmailAsync(string email) =>
            await _ctx.Users.FirstOrDefaultAsync(u => u.Email == email);

        public async Task<User?> GetByUsernameAsync(string username) =>
            await _ctx.Users.FirstOrDefaultAsync(u => u.Username == username);

        public async Task AddAsync(User user)
        {
            // Lưu ngay để ID sinh bởi database có sẵn cho nơi gọi.
            await _ctx.Users.AddAsync(user);
            await _ctx.SaveChangesAsync();
        }

        public async Task UpdateAsync(User user)
        {
            _ctx.Users.Update(user);
            await _ctx.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            // Đây là xóa vật lý cấp repository; API Admin hiện chỉ khóa mềm
            // bằng IsActive=false để giữ lịch sử giao dịch.
            var user = await GetByIdAsync(id);
            if (user != null)
            {
                _ctx.Users.Remove(user);
                await _ctx.SaveChangesAsync();
            }
        }
    }
}
