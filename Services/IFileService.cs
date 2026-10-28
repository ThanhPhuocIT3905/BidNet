using BidNet.DTOs;
using Microsoft.AspNetCore.Http;

namespace BidNet.Services
{
    public interface IFileService
    {
        Task<FileResponseDto> UploadFileAsync(IFormFile file, CancellationToken cancellationToken = default);
        Task<FileDownloadDto?> GetFileForDownloadAsync(int id, CancellationToken cancellationToken = default);
    }
}