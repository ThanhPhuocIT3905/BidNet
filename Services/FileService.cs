using Microsoft.AspNetCore.Http;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Repositories;

namespace BidNet.Services
{
    public class FileService : IFileService
    {
        public const long MaximumFileSizeBytes = 5 * 1024 * 1024;

        private readonly IFileRepository _fileRepository;

        public FileService(IFileRepository fileRepository)
        {
            _fileRepository = fileRepository;
        }

        public async Task<FileResponseDto> UploadFileAsync(
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
                throw new ApiException(400, "invalid_file", "File không hợp lệ.");
            if (file.Length > MaximumFileSizeBytes)
                throw new ApiException(413, "file_too_large", "Dung lượng file tối đa là 5 MB.");

            var fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ApiException(400, "invalid_file_name", "Tên file không hợp lệ.");

            var extension = Path.GetExtension(fileName);
            var expectedContentType = extension.ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => null
            };
            var contentType = file.ContentType.Split(';', 2)[0].Trim();
            if (expectedContentType is null ||
                !string.Equals(contentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
                throw new ApiException(400, "unsupported_file_type", "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");

            using var memoryStream = new MemoryStream((int)file.Length);
            await file.CopyToAsync(memoryStream, cancellationToken);

            var content = memoryStream.ToArray();
            var storedFile = new StoredFile
            {
                FileName = fileName,
                ContentType = expectedContentType,
                Content = content,
                Length = content.LongLength
            };

            var createdFile = await _fileRepository.AddAsync(storedFile, cancellationToken);

            return new FileResponseDto
            {
                Id = createdFile.Id,
                FileName = createdFile.FileName,
                Size = createdFile.Length,
                UploadedAt = createdFile.UploadedAt
            };
        }

        public async Task<FileDownloadDto?> GetFileForDownloadAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            var file = await _fileRepository.GetByIdAsync(id, cancellationToken);
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