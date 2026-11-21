using BidNet.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers
{
    /// <summary>
    /// Endpoint dùng để kiểm tra Exception Middleware. Có thể xóa khi không cần demo.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ErrorsController : ControllerBase
    {
        [HttpGet("bad-request")]
        public IActionResult BadRequestError()
        {
            throw new BadRequestException("Đây là lỗi 400 từ Exception Middleware.");
        }

        [HttpGet("not-found")]
        public IActionResult NotFoundError()
        {
            throw new NotFoundException("Đây là lỗi 404 từ Exception Middleware.");
        }

        [HttpGet("unauthorized")]
        public IActionResult UnauthorizedError()
        {
            throw new UnauthorizedException("Đây là lỗi 401 từ Exception Middleware.");
        }

        [HttpGet("server")]
        public IActionResult ServerError()
        {
            throw new Exception("Đây là lỗi 500 giả lập (unhandled exception).");
        }
    }
}
