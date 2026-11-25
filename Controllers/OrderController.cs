using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/orders")]
public class OrderController(IOrderService orders) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<PagedResponseDto<OrderResponseDto>>> Mine(
        string? role = "all", int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await orders.MineAsync(role, page, pageSize, ct));

    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<ActionResult<PagedResponseDto<OrderResponseDto>>> All(
        string? status = null, int page = 1, int pageSize = 20, CancellationToken ct = default) =>
        Ok(await orders.AllAsync(status, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> Get(int id, CancellationToken ct) =>
        Ok(await orders.GetAsync(id, ct));

    [HttpPatch("{id:int}/shipping-address")]
    public async Task<ActionResult<OrderResponseDto>> UpdateShippingAddress(
        int id, UpdateShippingAddressDto request, CancellationToken ct) =>
        Ok(await orders.UpdateShippingAddressAsync(id, request, ct));

    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<OrderResponseDto>> UpdateStatus(
        int id, UpdateOrderStatusDto request, CancellationToken ct) =>
        Ok(await orders.UpdateStatusAsync(id, request, ct));
}
