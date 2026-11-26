using System.ComponentModel.DataAnnotations;
using BidNet.Data;
using BidNet.Models;
using BidNet.Services;
using BidNet.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using BidNet.DTOs;

namespace BidNet.Controllers;

[ApiController]
[Authorize]
[Route("api/support")]
public class SupportController(AppDbContext db, CurrentUser currentUser, IHubContext<SupportHub>? hub = null) : ControllerBase
{
    private readonly SupportService support = new(db, currentUser);

    [HttpPost]
    [EnableRateLimiting("support")]
    public async Task<IActionResult> Send(SupportRequest request, CancellationToken ct)
    {
        var ticket = await support.CreateAsync(request, ct);
        // Thông báo realtime cho Admin khi có ticket mới.
        if (hub != null)
            await hub.Clients.Group(SupportHub.AdminGroup)
                .SendAsync("TicketCreated", new { ticket.Id, ticket.Subject, ticket.RequesterName, ticket.CreatedAt }, ct);
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
        var msg = await support.ReplyAsync(id, request, ct);
        // Phát realtime tin nhắn mới cho tất cả thành viên trong nhóm ticket.
        if (hub != null)
        {
            await hub.Clients.Group(SupportHub.TicketGroup(id))
                .SendAsync("MessageReceived", msg, ct);
            // Thông báo thêm cho Admin nếu người dùng vừa gửi.
            if (msg.SenderType == "User")
                await hub.Clients.Group(SupportHub.AdminGroup)
                    .SendAsync("TicketUpdated", new { ticketId = id, unread = true }, ct);
        }
        return Ok(msg);
    }

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Status(int id, TicketStatusDto request, CancellationToken ct)
    {
        await support.SetStatusAsync(id, request, ct);
        if (hub != null)
            await hub.Clients.Group(SupportHub.TicketGroup(id))
                .SendAsync("TicketStatusChanged", new { ticketId = id, status = request.Status.ToString() }, ct);
        return NoContent();
    }

    /// <summary>AI gợi ý câu hỏi và câu trả lời theo ngữ cảnh trang – không cần API key thật.</summary>
    [HttpPost("ai/suggest")]
    [EnableRateLimiting("support")]
    [AllowAnonymous]
    public IActionResult AiSuggest([FromBody] AiSuggestDto dto) =>
        Ok(SupportAiEngine.Respond(dto));

    /// <summary>Lấy FAQ theo chủ đề (không cần đăng nhập).</summary>
    [HttpGet("faq")]
    [AllowAnonymous]
    public IActionResult Faq([FromQuery] string? topic) =>
        Ok(SupportAiEngine.GetFaq(topic));
}

public class SupportRequest : CreateTicketDto { }
