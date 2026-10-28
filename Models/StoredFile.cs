namespace BidNet.Models;

public class StoredFile
{
    public int Id { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public required byte[] Content { get; set; }
    public long Length { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}