using System.Diagnostics;

namespace BidNet.Middleware
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var stopwatch = Stopwatch.StartNew();

            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();

                var statusCode = context.Response.StatusCode;
                var userName = context.User.Identity?.IsAuthenticated == true
                    ? context.User.Identity.Name
                    : "anonymous";

                _logger.LogInformation(
                    "HTTP {Method} {Path} => {StatusCode} in {ElapsedMs}ms User={User} TraceId={TraceId}",
                    context.Request.Method,
                    context.Request.Path,
                    statusCode,
                    stopwatch.ElapsedMilliseconds,
                    userName,
                    context.TraceIdentifier);
            }
        }
    }
}
