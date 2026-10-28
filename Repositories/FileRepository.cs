using BidNet.Data;
using BidNet.Models;

namespace BidNet.Repositories
{
    public class FileRepository : IFileRepository
    {
        private readonly AppDbContext _context;

        public FileRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<StoredFile> AddAsync(StoredFile file, CancellationToken cancellationToken = default)
        {
            await _context.StoredFiles.AddAsync(file, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
            return file;
        }

        public async Task<StoredFile?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _context.StoredFiles.FindAsync([id], cancellationToken);
        }
    }
}