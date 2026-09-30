using BidNet.Models;

namespace BidNet.Repositories
{
    // Hợp đồng truy cập bảng Bids; quy tắc giá tối thiểu nằm ở BidService.
    public interface IBidRepository
    {
        Task<Bid?> GetBidByIdAsync(int id);
        Task AddAsync(Bid bid);
        Task UpdateAsync(Bid bid);
        Task DeleteAsync(Bid bid);
        Task<IEnumerable<Bid>> GetBidsByProductIdAsync(int productId);
    }
}
