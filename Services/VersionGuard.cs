namespace BidNet.Services;

public static class VersionGuard
{
    // Optional on existing APIs for older clients; the current UI always sends it.
    public static void Check(string? expected, byte[] current)
    {
        if (expected is not null && expected != Convert.ToBase64String(current))
            throw new ApiException(409, "stale_version", "Dữ liệu đã thay đổi từ lúc bạn mở trang. Hãy tải lại trước khi lưu.");
    }
}
