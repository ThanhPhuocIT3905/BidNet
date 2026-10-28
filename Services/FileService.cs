using Microsoft.AspNetCore.Http;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Repositories;

namespace BidNet.Services
{
    public class FileService : IFileService
    {
        private readonly IFileRepository _fileRepository;

        public FileService(IFileRepository fileRepository)
        {
            _fileRepository = fileRepository;
        }

        public async Task<FileResponseDto> UploadFileAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ApiException(400, "invalid_file", "File không hợp lệ.");

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);

            var fileName = Path.GetFileName(file.FileName);
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ApiException(400, "invalid_file_name", "Tên file không hợp lệ.");

            var content = memoryStream.ToArray();
            var storedFile = new StoredFile
            {
                FileName = fileName,
                ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                    ? "application/octet-stream"
                    : file.ContentType,
                Content = content,
                Length = content.LongLength
            };

            var createdFile = await _fileRepository.AddAsync(storedFile);

            return new FileResponseDto
            {
                Id = createdFile.Id,
                FileName = createdFile.FileName,
                Size = createdFile.Length,
                UploadedAt = createdFile.UploadedAt
            };
        }

        public async Task<FileDownloadDto?> GetFileForDownloadAsync(int id)
        {
            var file = await _fileRepository.GetByIdAsync(id);
            if (file == null) return null;

            return new FileDownloadDto
            {
                Content = file.Content,
                ContentType = file.ContentType,
                FileName = file.FileName
            };
        }
    }
}