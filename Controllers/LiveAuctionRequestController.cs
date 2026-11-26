using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/me/live-requests")]
public class MyLiveAuctionRequestsController(LiveAuctionRequestService requests) : ControllerBase
{
    [HttpGet("eligible-products")]
    public async Task<ActionResult<List<LiveAuctionEligibleProductDto>>> EligibleProducts(CancellationToken ct) =>
        Ok(await requests.EligibleProductsAsync(ct));

    [HttpGet]
    public async Task<ActionResult<List<LiveAuctionRequestDto>>> Mine(CancellationToken ct) =>
        Ok(await requests.MineAsync(ct));

    [HttpPost]
    public async Task<ActionResult<LiveAuctionRequestDto>> Create(CreateLiveAuctionRequestDto input, CancellationToken ct) =>
        Ok(await requests.CreateAsync(input, ct));

    [HttpPut("{id:int}")]
    public async Task<ActionResult<LiveAuctionRequestDto>> UpdateAndResubmit(
        int id, UpdateLiveAuctionRequestDto input, CancellationToken ct) =>
        Ok(await requests.UpdateAndResubmitAsync(id, input, ct));

    [HttpPost("{id:int}/confirm")]
    public async Task<ActionResult<LiveAuctionRequestDto>> Confirm(int id, CancellationToken ct) =>
        Ok(await requests.ConfirmTermsAsync(id, ct));

    [HttpPost("{id:int}/withdraw")]
    public async Task<IActionResult> Withdraw(int id, CancellationToken ct)
    {
        await requests.WithdrawAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/live-requests")]
public class AdminLiveAuctionRequestsController(LiveAuctionRequestService requests) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<LiveAuctionRequestDto>>> List(
        string? status, string? q, CancellationToken ct) =>
        Ok(await requests.AdminListAsync(status, q, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LiveAuctionRequestDto>> Get(int id, CancellationToken ct) =>
        Ok(await requests.AdminGetAsync(id, ct));

    [HttpPost("{id:int}/review")]
    public async Task<ActionResult<LiveAuctionRequestDto>> Review(int id, CancellationToken ct) =>
        Ok(await requests.StartReviewAsync(id, ct));

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<LiveAuctionRequestDto>> Approve(
        int id, ReviewLiveAuctionRequestDto input, CancellationToken ct) =>
        Ok(await requests.ApproveAsync(id, input, ct));

    [HttpPost("{id:int}/revision")]
    public async Task<ActionResult<LiveAuctionRequestDto>> RequestRevision(
        int id, LiveAuctionRequestMessageDto input, CancellationToken ct) =>
        Ok(await requests.RequestRevisionAsync(id, input, ct));

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<LiveAuctionRequestDto>> Reject(
        int id, LiveAuctionRequestMessageDto input, CancellationToken ct) =>
        Ok(await requests.RejectAsync(id, input, ct));

    [HttpGet("/api/admin/live-inventory")]
    public async Task<ActionResult<List<LiveProductOptionDto>>> Inventory(string? q, CancellationToken ct) =>
        Ok(await requests.InventoryAsync(q, ct));
}
