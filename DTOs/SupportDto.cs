using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using BidNet.Models;

namespace BidNet.DTOs;

public class CreateTicketDto
{
    [MaxLength(160)] public string? Subject { get; set; }
    [Required, MaxLength(700)] public string Message { get; set; } = string.Empty;
    public int? ProductId { get; set; }
    public int? OrderId { get; set; }
}
public class TicketReplyDto
{
    [Required, MaxLength(2000)] public string Message { get; set; } = string.Empty;
    public string? Version { get; set; }
}
public class TicketStatusDto
{
    [EnumDataType(typeof(TicketStatus)), JsonConverter(typeof(JsonStringEnumConverter<TicketStatus>))]
    public TicketStatus Status { get; set; }
    [Required] public string Version { get; set; } = string.Empty;
}
public class TicketDto
{
    public int Id { get; set; }
    public string Subject { get; set; } = string.Empty;
    public int RequesterId { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public int? ProductId { get; set; }
    public int? OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Version { get; set; } = string.Empty;
    public int MessagePage { get; set; }
    public int MessagePages { get; set; }
    public List<TicketMessageDto> Messages { get; set; } = [];
}
public record TicketMessageDto(int Id, string AuthorName, bool IsAdmin, string Body, DateTime CreatedAt);
