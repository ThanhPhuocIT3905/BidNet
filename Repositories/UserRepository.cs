using BidNet.Data;
using BidNet.DTOs.Common;
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
            // UserService loads a tracked user; only changed profile fields are saved.
            // Marking the entire row Modified could overwrite a concurrent admin lock.
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

        public async Task<PagedResult<User>> GetAllAsync(UserQueryParameters queryParams)
        {
            var query = _ctx.Users.AsNoTracking().AsQueryable();

            // 1. SEARCH (Tìm kiếm tương đối)
            if (!string.IsNullOrWhiteSpace(queryParams.SearchTerm))
            {
                var term = queryParams.SearchTerm.Trim().ToLower();
                query = query.Where(u => u.Username.ToLower().Contains(term)
                                      || u.Email.ToLower().Contains(term));
            }

            // 2. FILTER (Lọc chính xác)
            if (!string.IsNullOrWhiteSpace(queryParams.Role))
            {
                query = query.Where(u => u.Role == queryParams.Role);
            }

            if (queryParams.IsActive.HasValue)
                query = query.Where(u => u.IsActive == queryParams.IsActive.Value);

            // 3. SORTING
            query = queryParams.SortBy?.ToLower() switch
            {
                "email" => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.Email)
                    : query.OrderBy(u => u.Email),

                "createdat" => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.CreatedAt)
                    : query.OrderBy(u => u.CreatedAt),

                _ => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.Username)
                    : query.OrderBy(u => u.Username) // Mặc định sort theo UserName
            };

            // 4. COUNT (Tổng số dòng thỏa điều kiện search/filter)
            var totalCount = await query.CountAsync();

            // 5. PAGINATION (Chỉ lấy đúng PageSize dòng từ DB)
            var items = await query
                .Skip((queryParams.PageNumber - 1) * queryParams.PageSize)
                .Take(queryParams.PageSize)
                .ToListAsync();

            return new PagedResult<User>(items, totalCount, queryParams.PageNumber, queryParams.PageSize);
        }
    }
}
