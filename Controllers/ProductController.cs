using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BidNet.Controllers;

[ApiController]
[Route("api/products")]
public class ProductController(IProductService products, IBidService bids) : ControllerBase
{
    // Danh sách và chi tiết đọc công khai; thao tác ghi yêu cầu JWT.
    // Bộ lọc đi qua query string, ví dụ ?status=Active&page=1&pageSize=20.
    [HttpGet]
    public async Task<ActionResult<PagedResponseDto<ProductResponseDto>>> List(
        [FromQuery] ProductQueryDto query, CancellationToken ct) =>
        Ok(await products.ListAsync(query, ct));

    [Authorize]
    [HttpGet("me")]
    // /me là route riêng; {id:int} không thể bắt nhầm chữ "me" thành ID.
    public async Task<ActionResult<PagedResponseDto<ProductResponseDto>>> Mine(
        int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await products.MineAsync(page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductResponseDto>> Get(int id, CancellationToken ct) =>
        Ok(await products.GetAsync(id, ct));

    [Authorize]
    [HttpPost]
    // 201 Created kèm Location trỏ đến GET chi tiết sản phẩm vừa tạo.
    public async Task<ActionResult<ProductResponseDto>> Create(CreateProductDto request, CancellationToken ct)
    {
        var result = await products.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [Authorize]
    [HttpPut("{id:int}")]
    // Service kiểm người sở hữu và trạng thái trước khi sửa, không tin ID trong body.
    public async Task<ActionResult<ProductResponseDto>> Update(
        int id, UpdateProductDto request, CancellationToken ct) =>
        Ok(await products.UpdateAsync(id, request, ct));

    [Authorize]
    [HttpPost("{id:int}/bids")]
    [EnableRateLimiting("bid")]
    // Rate limit giảm spam; BidService lấy UserId từ JWT và trả 409 khi đua giá.
    public async Task<ActionResult<BidResponseDto>> PlaceBid(
        int id, PlaceBidDto request, CancellationToken ct)
    {
        var result = await bids.PlaceAsync(id, request.Amount, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("{id:int}/bids")]
    // Lịch sử bid công khai không trả danh tính người đặt giá.
    public async Task<ActionResult<PagedResponseDto<PublicBidDto>>> GetBids(
        int id, int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await bids.ForProductAsync(id, page, pageSize, ct));
}
