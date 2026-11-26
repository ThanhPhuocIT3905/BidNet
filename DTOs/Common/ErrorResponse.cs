namespace BidNet.DTOs.Common
{
    public class ErrorResponse
    {
        public int StatusCode { get; set; }
        public string? Code { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Detail { get; set; }
        public string TraceId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
