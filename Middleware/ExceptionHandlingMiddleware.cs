using System.Text.Json;
using BidNet.DTOs.Common;
using BidNet.Exceptions;
using BidNet.Services;

namespace BidNet.Middleware
{
    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;
        private readonly IHostEnvironment _env;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public ExceptionHandlingMiddleware(
            RequestDelegate next,
            ILogger<ExceptionHandlingMiddleware> logger,
            IHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            // Client ngắt kết nối giữa chừng không phải lỗi nghiệp vụ của server.
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var (statusCode, message) = MapException(exception);

            if (statusCode >= StatusCodes.Status500InternalServerError)
            {
                _logger.LogError(
                    exception,
                    "Unhandled exception. TraceId={TraceId} {Method} {Path}",
                    context.TraceIdentifier,
                    context.Request.Method,
                    context.Request.Path);
            }
            else
            {
                _logger.LogWarning(
                    exception,
                    "Handled exception {StatusCode}. TraceId={TraceId} {Method} {Path}",
                    statusCode,
                    context.TraceIdentifier,
                    context.Request.Method,
                    context.Request.Path);
            }

            var response = new ErrorResponse
            {
                StatusCode = statusCode,
                Code = (exception as ApiException)?.Code,
                Message = message,
                Detail = _env.IsDevelopment() ? exception.ToString() : null,
                TraceId = context.TraceIdentifier,
                Timestamp = DateTime.UtcNow
            };

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = statusCode;

            await context.Response.WriteAsync(JsonSerializer.Serialize(response, JsonOptions));
        }

        private static (int StatusCode, string Message) MapException(Exception exception)
        {
            return exception switch
            {
                AppException appEx => (appEx.StatusCode, appEx.Message),
                ApiException apiEx => (apiEx.StatusCode, apiEx.Message),
                Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException =>
                    (409, "Dữ liệu vừa thay đổi. Hãy tải lại trước khi thao tác."),
                Microsoft.EntityFrameworkCore.DbUpdateException { InnerException: Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 } } =>
                    (409, "Dữ liệu đã tồn tại hoặc vừa được xử lý. Hãy tải lại."),
                ArgumentException =>
                    (StatusCodes.Status400BadRequest, exception.Message),
                KeyNotFoundException =>
                    (StatusCodes.Status404NotFound, exception.Message),
                UnauthorizedAccessException =>
                    (StatusCodes.Status401Unauthorized, exception.Message),
                _ => (
                    StatusCodes.Status500InternalServerError,
                    "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.")
            };
        }
    }
}
