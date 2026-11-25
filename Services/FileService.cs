using Microsoft.AspNetCore.Http;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Repositories;

namespace BidNet.Services
{
    public class FileService(IFileRepository fileRepository, CurrentUser currentUser) : IFileService
    {
        public const long MaximumFileSizeBytes = 5 * 1024 * 1024;

        public async Task<FileResponseDto> UploadFileAsync(
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            await currentUser.RequireActiveAsync(cancellationToken);

            if (file == null || file.Length == 0)
                throw new ApiException(400, "invalid_file", "File không hợp lệ.");
            if (file.Length > MaximumFileSizeBytes)
                throw new ApiException(413, "file_too_large", "Dung lượng file tối đa là 5 MB.");

            var fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ApiException(400, "invalid_file_name", "Tên file không hợp lệ.");
            if (fileName.Length > 255)
                fileName = fileName[..255];

            var extension = Path.GetExtension(fileName);
            var expectedContentType = extension.ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => null
            };
            var contentType = (file.ContentType ?? string.Empty).Split(';', 2)[0].Trim();
            if (expectedContentType is null ||
                !string.Equals(contentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
                throw new ApiException(400, "unsupported_file_type", "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream, cancellationToken);
            if (memoryStream.Length == 0 || memoryStream.Length > MaximumFileSizeBytes)
                throw new ApiException(413, "file_too_large", "Dung lượng file tối đa là 5 MB.");

            var content = memoryStream.ToArray();
            if (!MatchesMagicBytes(content, expectedContentType))
                throw new ApiException(400, "invalid_file_signature",
                    "Nội dung file không khớp định dạng ảnh PNG, JPEG hoặc WebP.");

            var storedFile = new StoredFile
            {
                FileName = fileName,
                ContentType = expectedContentType,
                Content = content,
                Length = content.LongLength
            };

            var createdFile = await fileRepository.AddAsync(storedFile, cancellationToken);

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
            var file = await fileRepository.GetByIdAsync(id, cancellationToken);
            if (file == null) return null;

            return new FileDownloadDto
            {
                Content = file.Content,
                ContentType = file.ContentType,
                FileName = file.FileName
            };
        }

        private static bool MatchesMagicBytes(byte[] data, string contentType) => contentType switch
        {
            // JPEG: FF D8 FF
            "image/jpeg" => data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF,
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            "image/png" => data.Length >= 8 &&
                           data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
                           data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A,
            // WebP: RIFF .... WEBP
            "image/webp" => data.Length >= 12 &&
                            data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
                            data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50,
            _ => false
        };
    }
}
