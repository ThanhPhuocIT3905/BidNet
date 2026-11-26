using BidNet.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BidNet.Services;

namespace BidNet.Controllers
{
    /// <summary>
    /// Endpoint dùng để kiểm tra Exception Middleware. Có thể xóa khi không cần demo.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ErrorsController(IHostEnvironment environment, CurrentUser currentUser) : ControllerBase
    {
        private async Task RequireDiagnosticsAsync()
        {
            if (!environment.IsDevelopment())
                throw new NotFoundException("Không tìm thấy tài nguyên.");
            await currentUser.RequireAdminAsync(HttpContext.RequestAborted);
        }
        [HttpGet("bad-request")]
        public async Task<IActionResult> BadRequestError()
        {
            await RequireDiagnosticsAsync();
            throw new BadRequestException("Đây là lỗi 400 từ Exception Middleware.");
        }

        [HttpGet("not-found")]
        public async Task<IActionResult> NotFoundError()
        {
            await RequireDiagnosticsAsync();
            throw new NotFoundException("Đây là lỗi 404 từ Exception Middleware.");
        }

        [HttpGet("unauthorized")]
        public async Task<IActionResult> UnauthorizedError()
        {
            await RequireDiagnosticsAsync();
            throw new UnauthorizedException("Đây là lỗi 401 từ Exception Middleware.");
        }

        [HttpGet("server")]
        public async Task<IActionResult> ServerError()
        {
            await RequireDiagnosticsAsync();
            throw new Exception("Đây là lỗi 500 giả lập (unhandled exception).");
        }
    }
}
