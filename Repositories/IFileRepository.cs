using BidNet.Models;

namespace BidNet.Repositories
{
    public interface IFileRepository
    {
        Task<StoredFile> AddAsync(StoredFile file);
        Task<StoredFile?> GetByIdAsync(int id);
    }
}
