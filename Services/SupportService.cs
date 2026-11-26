using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class SupportService(AppDbContext db, CurrentUser currentUser)
{
    public async Task<TicketDto> CreateAsync(CreateTicketDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireMemberAsync(ct);
        if (string.IsNullOrWhiteSpace(request.Message))
            throw new ApiException(400, "empty_message", "Vui lòng nhập nội dung cần hỗ trợ.");
        if (request.ProductId.HasValue && !await db.Products.AnyAsync(p => p.Id == request.ProductId, ct))
            throw new ApiException(400, "product_not_found", "Phiên liên quan không tồn tại.");
        if (request.OrderId.HasValue)
        {
            var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == request.OrderId &&
                (o.BuyerId == user.Id || o.SellerId == user.Id), ct)
                ?? throw new ApiException(404, "order_not_found", "Không tìm thấy đơn hàng của bạn.");
            if (request.ProductId.HasValue && request.ProductId != order.ProductId)
                throw new ApiException(400, "order_product_mismatch", "Đơn hàng không thuộc phiên đã chọn.");
            request.ProductId = order.ProductId;
        }
        var admins = await db.Users.Where(u => u.Role == "Admin" && u.IsActive).Select(u => u.Id).ToListAsync(ct);
        if (admins.Count == 0)
            throw new ApiException(503, "support_unavailable", "Hiện chưa có quản trị viên tiếp nhận. Vui lòng thử lại sau.");
        var subject = string.IsNullOrWhiteSpace(request.Subject) ? "Yêu cầu hỗ trợ" : request.Subject.Trim();
        var ticket = new SupportTicket
        {
            RequesterId = user.Id, Requester = user, Subject = subject,
            ProductId = request.ProductId, OrderId = request.OrderId,
            PageContext = request.PageContext?.Trim()
        };
        ticket.Messages.Add(new SupportMessage { AuthorId = user.Id, Body = request.Message.Trim() });
        db.SupportTickets.Add(ticket);
        foreach (var id in admins)
        {
            var notification = new Notification { UserId = id, Title = $"Yêu cầu hỗ trợ từ {user.Username}",
                Message = $"Tài khoản #{user.Id} · {user.Email}\n{request.Message.Trim()}" };
            db.Notifications.Add(notification);
            notification.Ticket = ticket;
        }
        await db.SaveChangesAsync(ct);
        return Map(ticket);
    }

    public async Task<PagedResponseDto<TicketDto>> ListAsync(int page, string? status, string? q, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, 20);
        var query = db.SupportTickets.AsNoTracking().Include(t => t.Requester).AsQueryable();
        if (user.Role != "Admin") query = query.Where(t => t.RequesterId == user.Id);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<TicketStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new ApiException(400, "invalid_status", "Trạng thái yêu cầu không hợp lệ.");
            query = query.Where(t => t.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            int.TryParse(term.TrimStart('#'), out var id);
            query = query.Where(t => t.Subject.Contains(term) || t.Id == id);
        }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(t => t.UpdatedAt).ThenByDescending(t => t.Id)
            .Skip((args.Page - 1) * 20).Take(20).ToListAsync(ct);
        return new() { Items = items.Select(Map).ToList(), Page = page, PageSize = 20, TotalCount = total };
    }

    public async Task<TicketDto> GetAsync(int id, int messagePage, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var ticket = await FindAsync(id, user, ct);
        var args = PageArgs.Validate(messagePage, 50);
        var query = db.SupportMessages.AsNoTracking().Where(m => m.TicketId == id);
        var result = Map(ticket);
        result.MessagePage = args.Page;
        result.MessagePages = Math.Max(1, (int)Math.Ceiling(await query.CountAsync(ct) / 50d));
        result.Messages = await query.OrderByDescending(m => m.Id).Skip((args.Page - 1) * 50).Take(50)
            .Select(m => new TicketMessageDto(m.Id, m.Author.Username, m.Author.Role == "Admin", m.Body, m.CreatedAt,
                m.Author.Role == "Admin" ? "Agent" : "User")).ToListAsync(ct);
        result.Messages.Reverse();
        return result;
    }

    public async Task<TicketMessageDto> ReplyAsync(int id, TicketReplyDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var ticket = await FindAsync(id, user, ct);
        VersionGuard.Check(request.Version, ticket.RowVersion);
        if (string.IsNullOrWhiteSpace(request.Message))
            throw new ApiException(400, "empty_message", "Nội dung phản hồi không được trống.");
        var msg = new SupportMessage { AuthorId = user.Id, Body = request.Message.Trim() };
        ticket.Messages.Add(msg);
        ticket.UpdatedAt = DateTime.UtcNow;
        if (user.Role == "Admin" && ticket.Status == TicketStatus.Open) ticket.Status = TicketStatus.InProgress;
        if (user.Role != "Admin" && ticket.Status == TicketStatus.Resolved) ticket.Status = TicketStatus.Open;
        var recipients = user.Role == "Admin" ? new List<int> { ticket.RequesterId } :
            await db.Users.Where(u => u.Role == "Admin" && u.IsActive).Select(u => u.Id).ToListAsync(ct);
        foreach (var receiver in recipients)
            db.Notifications.Add(new Notification { UserId = receiver, TicketId = id,
                Title = $"Phản hồi yêu cầu #{id}", Message = $"Có phản hồi mới cho yêu cầu: {ticket.Subject}." });
        await db.SaveChangesAsync(ct);
        return new TicketMessageDto(msg.Id, user.Username, user.Role == "Admin", msg.Body, msg.CreatedAt,
            user.Role == "Admin" ? "Agent" : "User");
    }

    public async Task SetStatusAsync(int id, TicketStatusDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireAdminAsync(ct);
        var ticket = await FindAsync(id, user, ct);
        VersionGuard.Check(request.Version, ticket.RowVersion);
        if (!Enum.IsDefined(request.Status)) throw new ApiException(400, "invalid_status", "Trạng thái không hợp lệ.");
        if (ticket.Status == request.Status) return;
        if (request.Status == TicketStatus.Resolved && !await db.SupportMessages.AnyAsync(m => m.TicketId == id && m.Author.Role == "Admin", ct))
            throw new ApiException(409, "reply_required", "Hãy phản hồi hướng xử lý trước khi đánh dấu đã giải quyết.");
        var before = ticket.Status;
        ticket.Status = request.Status;
        ticket.UpdatedAt = DateTime.UtcNow;
        db.AdminAuditLogs.Add(new AdminAuditLog { ActorId = user.Id, Action = "TicketStatusChanged", EntityType = "SupportTicket", EntityId = id, Note = $"{before} → {request.Status}" });
        db.Notifications.Add(new Notification { UserId = ticket.RequesterId, TicketId = id,
            Title = $"Cập nhật yêu cầu #{id}", Message = request.Status == TicketStatus.Resolved ? "Yêu cầu đã được xử lý. Bạn có thể gửi thêm phản hồi để mở lại." : "Yêu cầu của bạn đang được tiếp nhận xử lý." });
        await db.SaveChangesAsync(ct);
    }

    private async Task<SupportTicket> FindAsync(int id, User user, CancellationToken ct) =>
        await db.SupportTickets.Include(t => t.Requester).FirstOrDefaultAsync(t => t.Id == id &&
            (user.Role == "Admin" || t.RequesterId == user.Id), ct)
        ?? throw new ApiException(404, "ticket_not_found", "Không tìm thấy yêu cầu hỗ trợ.");

    private static TicketDto Map(SupportTicket t) => new() { Id = t.Id, Subject = t.Subject,
        RequesterId = t.RequesterId, RequesterName = t.Requester.Username, ProductId = t.ProductId, OrderId = t.OrderId,
        Status = t.Status.ToString(), PageContext = t.PageContext, CreatedAt = t.CreatedAt, UpdatedAt = t.UpdatedAt, Version = Convert.ToBase64String(t.RowVersion) };
}

