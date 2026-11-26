using System.ComponentModel.DataAnnotations;
using BidNet.Data;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using BidNet.DTOs;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/support")]
public class SupportController(AppDbContext db, CurrentUser currentUser) : ControllerBase
{
    private readonly SupportService support = new(db, currentUser);
    [HttpPost]
    [EnableRateLimiting("support")]
    public async Task<IActionResult> Send(SupportRequest request, CancellationToken ct)
    {
        var ticket = await support.CreateAsync(request, ct);
        return Ok(new { ticket.Id, message = $"Đã tạo yêu cầu hỗ trợ #{ticket.Id}." });
    }

    [HttpGet]
    public Task<PagedResponseDto<TicketDto>> List(int page = 1, string? status = null, string? q = null, CancellationToken ct = default) =>
        support.ListAsync(page, status, q, ct);

    [HttpGet("{id:int}")]
    public Task<TicketDto> Get(int id, int messagePage = 1, CancellationToken ct = default) => support.GetAsync(id, messagePage, ct);

    [HttpPost("{id:int}/messages")]
    [EnableRateLimiting("support")]
    public async Task<IActionResult> Reply(int id, TicketReplyDto request, CancellationToken ct)
    {
        await support.ReplyAsync(id, request, ct);
        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Status(int id, TicketStatusDto request, CancellationToken ct)
    {
        await support.SetStatusAsync(id, request, ct);
        return NoContent();
    }
}

public class SupportRequest : CreateTicketDto { }
