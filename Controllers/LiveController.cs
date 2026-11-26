using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BidNet.Controllers;

[ApiController]
[Route("api/live")]
public class LiveController(LiveAuctionService live) : ControllerBase
{
    [HttpGet("events")]
    public async Task<ActionResult<List<LiveEventSummaryDto>>> Events(
        string? status, string? q, CancellationToken ct) =>
        Ok(await live.ListAsync(false, status, q, ct));

    [HttpGet("events/{id:int}")]
    public async Task<ActionResult<LiveEventDto>> Get(int id, CancellationToken ct) =>
        Ok(await live.GetAsync(id, ct));

    [HttpGet("events/{id:int}/snapshot")]
    public async Task<ActionResult<LiveSnapshotDto>> Snapshot(int id, CancellationToken ct) =>
        Ok(await live.SnapshotAsync(id, ct));

    [Authorize]
    [HttpPost("events/{id:int}/register")]
    public async Task<ActionResult<object>> Register(int id, CancellationToken ct) =>
        Ok(new { status = await live.RegisterAsync(id, ct) });

    [HttpGet("lots/{lotId:int}/bids")]
    public async Task<ActionResult<List<LiveBidDto>>> Bids(int lotId, CancellationToken ct) =>
        Ok(await live.RecentBidsAsync(lotId, ct));

    [Authorize]
    [EnableRateLimiting("bid")]
    [HttpPost("lots/{lotId:int}/bids")]
    public async Task<ActionResult<LiveBidDto>> Bid(int lotId, PlaceLiveBidDto dto, CancellationToken ct) =>
        Ok(await live.PlaceBidAsync(lotId, dto.Amount, ct));
}
