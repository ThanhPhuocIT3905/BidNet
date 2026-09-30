using BidNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Middleware;

public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    // Gom lỗi của toàn pipeline về một cấu trúc JSON có status và code.
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        // Client ngắt kết nối giữa chừng không phải lỗi nghiệp vụ của server.
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            // ApiException là lỗi dự kiến (400/403/409...). Lỗi khác trả 500
            // chung chung để không lộ stack trace/chi tiết database ra ngoài.
            var expected = ex as ApiException;
            if (expected is null)
                logger.LogError(ex, "Lỗi không mong đợi khi xử lý request.");
            var status = expected?.StatusCode ?? StatusCodes.Status500InternalServerError;
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = status,
                Title = expected?.Message ?? "Đã xảy ra lỗi trên server.",
                Extensions = { ["code"] = expected?.Code ?? "internal_error" }
            });
        }
    }
}
