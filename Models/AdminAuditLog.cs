using System.ComponentModel.DataAnnotations;

namespace BidNet.Models;

public class AdminAuditLog
{
    public int Id { get; set; }
    public int ActorId { get; set; }
    public User Actor { get; set; } = null!;
    [MaxLength(60)] public string Action { get; set; } = string.Empty;
    [MaxLength(40)] public string EntityType { get; set; } = string.Empty;
    // Historical identifier deliberately has no FK: category deletion must retain evidence.
    public int EntityId { get; set; }
    [MaxLength(500)] public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
