using BidNet.Data;
using BidNet.DTOs;
using BidNet.Exceptions;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class OrderWorkflow(AppDbContext db, CurrentUser currentUser)
{
    private IQueryable<Order> Query() => db.Orders.Include(o => o.Product).Include(o => o.Buyer).Include(o => o.Seller);

    public async Task<List<OrderResponseDto>> MineAsync(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var orders = await Query().AsNoTracking().Where(o => o.BuyerId == user.Id || o.SellerId == user.Id)
            .OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id).ToListAsync(ct);
        return orders.Select(Map).ToList();
    }

    public async Task<PagedResponseDto<OrderResponseDto>> ListAsync(int page, string? status, string? q, CancellationToken ct)
    {
        await currentUser.RequireAdminAsync(ct);
        var args = PageArgs.Validate(page, 20);
        var query = Query().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<OrderStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new ApiException(400, "invalid_status", "Trạng thái đơn hàng không hợp lệ.");
            query = query.Where(o => o.Status == parsed);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            int.TryParse(term.TrimStart('#'), out var id);
            query = query.Where(o => o.Id == id || (o.ProductNameSnapshot ?? o.Product.Name).Contains(term) ||
                o.Buyer.Username.Contains(term) || o.Seller.Username.Contains(term));
        }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id)
            .Skip((args.Page - 1) * 20).Take(20).ToListAsync(ct);
        return new() { Items = items.Select(Map).ToList(), Page = page, PageSize = 20, TotalCount = total };
    }

    public async Task<OrderResponseDto> GetAsync(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        return Map(await FindAsync(id, user, ct));
    }

    public async Task<PagedResponseDto<OrderEventDto>> HistoryAsync(int id, int page, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        await FindAsync(id, user, ct);
        var args = PageArgs.Validate(page, 20);
        var query = db.OrderEvents.AsNoTracking().Where(e => e.OrderId == id);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(e => e.Id).Skip((args.Page - 1) * 20).Take(20)
            .Select(e => new OrderEventDto(e.Id, e.Action, e.FromStatus.HasValue ? e.FromStatus.Value.ToString() : null,
                e.ToStatus.ToString(), e.Actor == null ? "Hệ thống" : e.Actor.Username, e.Note, e.CreatedAt)).ToListAsync(ct);
        return new() { Items = items, Page = page, PageSize = 20, TotalCount = total };
    }

    public async Task<OrderResponseDto> AddressAsync(int id, UpdateShippingAddressDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var order = await FindAsync(id, user, ct);
        if (order.BuyerId != user.Id) throw new ForbiddenException("Chỉ người mua mới được cập nhật địa chỉ giao hàng.");
        if (order.Status is OrderStatus.Delivered or OrderStatus.Cancelled)
            throw new ApiException(409, "order_closed", "Không thể sửa địa chỉ của đơn đã giao hoặc đã hủy.");
        VersionGuard.Check(request.Version, order.RowVersion);
        if (string.IsNullOrWhiteSpace(request.ShippingAddress)) throw new BadRequestException("Địa chỉ nhận hàng không được để trống.");
        var address = request.ShippingAddress.Trim();
        // Legacy clients may omit the new recipient fields without erasing stored values.
        var name = request.RecipientName?.Trim() ?? order.RecipientName;
        var phone = request.RecipientPhone?.Trim() ?? order.RecipientPhone;
        if (order.ShippingAddress == address && name == order.RecipientName && phone == order.RecipientPhone) return Map(order);
        order.ShippingAddress = address;
        order.RecipientName = name;
        order.RecipientPhone = phone;
        AddEvent(order, user, "ShippingUpdated", order.Status, "Người mua cập nhật thông tin nhận hàng.");
        db.Notifications.Add(new Notification { UserId = order.SellerId, OrderId = id,
            Title = $"Thông tin nhận hàng đơn #{id}", Message = "Người mua đã cập nhật thông tin giao hàng. Hãy kiểm tra trước khi gửi hàng." });
        await SaveAsync(ct);
        return Map(order);
    }

    public async Task<OrderResponseDto> PayDemoAsync(int id, DemoPaymentDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireMemberAsync(ct);
        var order = await FindAsync(id, user, ct);
        if (order.BuyerId != user.Id) throw new ForbiddenException("Chỉ người thắng cuộc mới được thanh toán đơn hàng.");

        if (request.PaymentMethod is not ("BANK_TRANSFER_DEMO" or "MOMO_DEMO"))
            throw new BadRequestException("Phương thức thanh toán demo không hợp lệ.");

        if (order.PaymentStatus == PaymentStatus.Paid)
        {
            if (order.PaymentMethod == request.PaymentMethod) return Map(order);
            throw new ApiException(409, "already_paid", "Đơn hàng đã được thanh toán bằng phương thức khác.");
        }

        if (order.Status != OrderStatus.Pending)
            throw new ApiException(409, "order_not_payable", "Đơn hàng này hiện không thể thanh toán.");

        VersionGuard.Check(request.Version, order.RowVersion);
        var now = DateTime.UtcNow;
        order.PaymentStatus = PaymentStatus.Paid;
        order.PaymentMethod = request.PaymentMethod;
        order.PaymentTransactionId = $"DEMO-{now:yyyyMMdd}-{order.Id:D3}";
        order.PaidAt = now;
        order.Status = OrderStatus.Paid;
        AddEvent(order, user, "DemoPaymentCompleted", OrderStatus.Pending,
            $"Thanh toán mô phỏng qua {request.PaymentMethod}; không phát sinh giao dịch tiền thật.");
        db.Notifications.Add(new Notification
        {
            UserId = order.SellerId,
            OrderId = order.Id,
            Title = $"Đơn hàng #{order.Id} đã được thanh toán",
            Message = $"Người mua đã hoàn tất thanh toán demo cho '{order.ProductNameSnapshot ?? order.Product.Name}'. Không phát sinh giao dịch tiền thật."
        });

        await SaveAsync(ct);
        return Map(order);
    }

    public async Task<OrderResponseDto> StatusAsync(int id, UpdateOrderStatusDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var order = await FindAsync(id, user, ct);
        if (order.SellerId != user.Id && user.Role != "Admin") throw new ForbiddenException("Chỉ người bán hoặc Admin mới được cập nhật trạng thái đơn hàng.");
        VersionGuard.Check(request.Version, order.RowVersion);
        if (order.Status == request.Status) return Map(order);
        if (order.Status == OrderStatus.Pending && request.Status == OrderStatus.Paid)
            throw new ApiException(409, "payment_required", "Người mua cần thanh toán qua chức năng thanh toán demo.");
        var allowed = order.Status switch {
            OrderStatus.Pending => request.Status == OrderStatus.Cancelled,
            OrderStatus.Paid => request.Status == OrderStatus.Delivered,
            _ => false
        };
        if (!allowed) throw new BadRequestException($"Không thể chuyển đơn hàng từ {order.Status} sang {request.Status}.");
        if (request.Status == OrderStatus.Delivered && string.IsNullOrWhiteSpace(order.ShippingAddress))
            throw new BadRequestException("Cần có địa chỉ nhận hàng trước khi xác nhận đã giao.");
        if (request.Status == OrderStatus.Cancelled && string.IsNullOrWhiteSpace(request.Note))
            throw new BadRequestException("Vui lòng ghi lý do hủy đơn hàng.");
        var previous = order.Status;
        order.Status = request.Status;
        if (order.Status == OrderStatus.Paid)
        {
            order.PaidAt = DateTime.UtcNow;
            order.PaymentStatus = PaymentStatus.Paid;
            order.PaymentMethod ??= "SELLER_CONFIRMED";
        }
        if (order.Status == OrderStatus.Delivered) order.CompletedAt = DateTime.UtcNow;
        if (order.Status == OrderStatus.Cancelled) order.CancellationReason = request.Note!.Trim();
        AddEvent(order, user, "StatusChanged", previous, request.Note?.Trim());
        var label = request.Status switch { OrderStatus.Delivered => "Đã xác nhận giao hàng", _ => "Đã hủy" };
        foreach (var receiver in new[] { order.BuyerId, order.SellerId }.Where(uid => uid != user.Id).Distinct())
            db.Notifications.Add(new Notification { UserId = receiver, OrderId = id, Title = $"Cập nhật đơn #{id}", Message = label });
        await SaveAsync(ct);
        return Map(order);
    }

    private void AddEvent(Order order, User user, string action, OrderStatus previous, string? note)
    {
        order.Events.Add(new OrderEvent { ActorId = user.Id, Action = action, FromStatus = previous, ToStatus = order.Status, Note = note });
        if (user.Role == "Admin") db.AdminAuditLogs.Add(new AdminAuditLog { ActorId = user.Id, Action = action,
            EntityType = "Order", EntityId = order.Id, Note = $"{previous} → {order.Status}" });
    }

    private async Task<Order> FindAsync(int id, User user, CancellationToken ct)
    {
        var order = await Query().FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException($"Không tìm thấy đơn hàng ID {id}.");
        if (order.BuyerId != user.Id && order.SellerId != user.Id && user.Role != "Admin")
            throw new ForbiddenException("Bạn không có quyền truy cập đơn hàng này.");
        return order;
    }
    private async Task SaveAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "order_changed", "Đơn hàng vừa thay đổi. Hãy tải lại trước khi thao tác."); }
    }
    private static OrderResponseDto Map(Order o) => new() {
        Id = o.Id, ProductId = o.ProductId, ProductName = o.ProductNameSnapshot ?? o.Product.Name, ProductImageUrl = o.Product.ImageUrl,
        BuyerId = o.BuyerId, BuyerName = o.Buyer.FullName ?? o.Buyer.Username, SellerId = o.SellerId, SellerName = o.Seller.FullName ?? o.Seller.Username,
        FinalPrice = o.FinalPrice, ShippingAddress = o.ShippingAddress, RecipientName = o.RecipientName, RecipientPhone = o.RecipientPhone,
        Status = o.Status.ToString(), CreatedAt = o.CreatedAt, CompletedAt = o.CompletedAt, PaidAt = o.PaidAt,
        PaymentStatus = o.PaymentStatus == PaymentStatus.Paid ? "PAID" : "UNPAID",
        PaymentMethod = o.PaymentMethod, PaymentTransactionId = o.PaymentTransactionId,
        CancellationReason = o.CancellationReason, Version = Convert.ToBase64String(o.RowVersion)
    };
}
