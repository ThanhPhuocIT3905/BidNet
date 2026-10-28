using BidNet.DTOs;
using Microsoft.AspNetCore.Http;

namespace BidNet.Services
{
    public interface IFileService
    {
        Task<FileResponseDto> UploadFileAsync(IFormFile file);
        Task<FileDownloadDto?> GetFileForDownloadAsync(int id);
    }
}