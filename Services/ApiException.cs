namespace BidNet.Services;

// Lỗi nghiệp vụ chủ động: middleware đổi thành HTTP status và mã code ổn định
// để frontend phân biệt với lỗi 500 không mong đợi.
public sealed class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
