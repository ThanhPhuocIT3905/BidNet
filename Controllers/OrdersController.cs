using BidNet.Data;
using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class OrdersController(AppDbContext db, CurrentUser currentUser) : ControllerBase
{
    private readonly OrderWorkflow orders = new(db, currentUser);

    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<OrderResponseDto>>> GetMyOrders(CancellationToken ct) => Ok(await orders.MineAsync(ct));

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResponseDto<OrderResponseDto>>> List(int page = 1, string? status = null, string? q = null, CancellationToken ct = default) =>
        Ok(await orders.ListAsync(page, status, q, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(int id, CancellationToken ct) => Ok(await orders.GetAsync(id, ct));

    [HttpGet("{id:int}/history")]
    public async Task<ActionResult<PagedResponseDto<OrderEventDto>>> History(int id, int page = 1, CancellationToken ct = default) => Ok(await orders.HistoryAsync(id, page, ct));

    [HttpPatch("{id:int}/shipping-address")]
    public async Task<ActionResult<OrderResponseDto>> UpdateShippingAddress(int id, UpdateShippingAddressDto dto, CancellationToken ct) => Ok(await orders.AddressAsync(id, dto, ct));

    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<OrderResponseDto>> UpdateStatus(int id, UpdateOrderStatusDto dto, CancellationToken ct) => Ok(await orders.StatusAsync(id, dto, ct));
}
