using BidNet.Models;

namespace BidNet.Repositories
{
    public interface IBidRepository
    {
        Task<Bid?> GetBidByIdAsync(int id);
        Task AddAsync(Bid bid);
        Task UpdateAsync(Bid bid);
        Task DeleteAsync(Bid bid);
        Task<IEnumerable<Bid>> GetBidsByProductIdAsync(int productId);
    }
}
