namespace BidNet.Exceptions
{
    public class AppException : Exception
    {
        public int StatusCode { get; }

        public AppException(string message, int statusCode = StatusCodes.Status400BadRequest)
            : base(message)
        {
            StatusCode = statusCode;
        }
    }

    public class NotFoundException : AppException
    {
        public NotFoundException(string message)
            : base(message, StatusCodes.Status404NotFound)
        {
        }
    }

    public class BadRequestException : AppException
    {
        public BadRequestException(string message)
            : base(message, StatusCodes.Status400BadRequest)
        {
        }
    }

    public class UnauthorizedException : AppException
    {
        public UnauthorizedException(string message)
            : base(message, StatusCodes.Status401Unauthorized)
        {
        }
    }

    // Đã đăng nhập nhưng không đủ quyền trên tài nguyên (401 là chưa xác thực,
    // 403 mới đúng ngữ nghĩa "không có quyền").
    public class ForbiddenException : AppException
    {
        public ForbiddenException(string message)
            : base(message, StatusCodes.Status403Forbidden)
        {
        }
    }
}
