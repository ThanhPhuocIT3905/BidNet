using BidNet.Models;

namespace BidNet.Repositories
{
    public interface IFileRepository
    {
        Task<StoredFile> AddAsync(StoredFile file, CancellationToken cancellationToken = default);
        Task<StoredFile?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    }
}
