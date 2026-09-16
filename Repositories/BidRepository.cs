using BidNet.Data;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Repositories
{
    public class BidRepository : IBidRepository
    {
        private readonly AppDbContext _ctx;
        public BidRepository(AppDbContext ctx) => _ctx = ctx;

        public async Task<IEnumerable<Bid>> GetBidsByProductIdAsync(int productId) => await _ctx.Bids
            .Where(b => b.ProductId == productId)
            .OrderByDescending(b => b.Amount)
            .ToListAsync();

        public async Task<Bid?> GetBidByIdAsync(int id) => await _ctx.Bids.FindAsync(id);

        public async Task AddAsync(Bid bid)
        {
            await _ctx.Bids.AddAsync(bid);
            await _ctx.SaveChangesAsync();
        }

        public async Task UpdateAsync(Bid bid)
        {
            _ctx.Bids.Update(bid);
            await _ctx.SaveChangesAsync();
        }

        public async Task DeleteAsync(Bid bid)
        {
            _ctx.Bids.Remove(bid);
            await _ctx.SaveChangesAsync();
        }
    }
}
