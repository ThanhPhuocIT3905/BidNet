using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public interface IOrderService
{
    Task<PagedResponseDto<OrderResponseDto>> MineAsync(string? role, int page, int pageSize, CancellationToken ct);
    Task<PagedResponseDto<OrderResponseDto>> AllAsync(string? status, int page, int pageSize, CancellationToken ct);
    Task<OrderResponseDto> GetAsync(int id, CancellationToken ct);
    Task<OrderResponseDto> UpdateShippingAddressAsync(int id, UpdateShippingAddressDto request, CancellationToken ct);
    Task<OrderResponseDto> UpdateStatusAsync(int id, UpdateOrderStatusDto request, CancellationToken ct);
}

public class OrderService(AppDbContext db, CurrentUser currentUser) : IOrderService
{
    public async Task<PagedResponseDto<OrderResponseDto>> MineAsync(
        string? role, int page, int pageSize, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);

        var query = db.Orders.AsNoTracking().AsQueryable();
        var normalized = role?.Trim().ToLowerInvariant();
        query = normalized switch
        {
            "buyer" => query.Where(o => o.BuyerId == user.Id),
            "seller" => query.Where(o => o.SellerId == user.Id),
            null or "" or "all" => query.Where(o => o.BuyerId == user.Id || o.SellerId == user.Id),
            _ => throw new ApiException(400, "invalid_role_filter", "Role lọc chỉ nhận buyer, seller hoặc all.")
        };

        return await PageAsync(query, args.Page, args.PageSize, ct);
    }

    public async Task<PagedResponseDto<OrderResponseDto>> AllAsync(
        string? status, int page, int pageSize, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        var query = db.Orders.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<OrderStatus>(status, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new ApiException(400, "invalid_order_status", "Trạng thái đơn hàng không hợp lệ.");
            query = query.Where(o => o.Status == parsed);
        }
        return await PageAsync(query, args.Page, args.PageSize, ct);
    }

    public async Task<OrderResponseDto> GetAsync(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var order = await WithDetails(db.Orders.AsNoTracking())
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new ApiException(404, "order_not_found", "Không tìm thấy đơn hàng.");

        var isAdmin = user.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && order.BuyerId != user.Id && order.SellerId != user.Id)
            throw new ApiException(403, "forbidden", "Bạn không có quyền xem đơn hàng này.");

        return ToResponse(order);
    }

    public async Task<OrderResponseDto> UpdateShippingAddressAsync(
        int id, UpdateShippingAddressDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var order = await WithDetails(db.Orders)
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new ApiException(404, "order_not_found", "Không tìm thấy đơn hàng.");

        if (order.BuyerId != user.Id)
            throw new ApiException(403, "not_buyer", "Chỉ người thắng đấu giá mới được cập nhật địa chỉ nhận hàng.");
        if (order.Status is OrderStatus.Shipped or OrderStatus.Completed or OrderStatus.Cancelled)
            throw new ApiException(409, "order_locked", "Không thể đổi địa chỉ khi đơn hàng đã giao, hoàn tất hoặc đã hủy.");

        var address = request.ShippingAddress.Trim();
        if (string.IsNullOrWhiteSpace(address))
            throw new ApiException(400, "invalid_address", "Địa chỉ nhận hàng không được để trống.");

        order.ShippingAddress = address;
        if (order.Status == OrderStatus.Pending)
            order.Status = OrderStatus.Processing;

        db.Notifications.Add(new Notification
        {
            UserId = order.SellerId,
            Title = "Người mua đã cập nhật địa chỉ giao hàng",
            Message = $"Đơn hàng #{order.Id} cho sản phẩm '{order.Product.Name}' đã có địa chỉ nhận hàng. Bạn có thể tiến hành giao hàng.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return ToResponse(order);
    }

    public async Task<OrderResponseDto> UpdateStatusAsync(
        int id, UpdateOrderStatusDto request, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var order = await WithDetails(db.Orders)
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new ApiException(404, "order_not_found", "Không tìm thấy đơn hàng.");

        if (!Enum.TryParse<OrderStatus>(request.Status, true, out var targetStatus) ||
            !Enum.IsDefined(targetStatus))
            throw new ApiException(400, "invalid_order_status",
                "Trạng thái chỉ nhận: Pending, Processing, Shipped, Completed, Cancelled.");

        if (order.Status is OrderStatus.Completed or OrderStatus.Cancelled)
            throw new ApiException(409, "order_closed", "Đơn hàng đã hoàn tất hoặc đã hủy.");

        var isAdmin = user.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        var isSeller = order.SellerId == user.Id;
        var isBuyer = order.BuyerId == user.Id;

        if (!isAdmin && !isSeller && !isBuyer)
            throw new ApiException(403, "forbidden", "Bạn không có quyền cập nhật đơn hàng này.");

        switch (targetStatus)
        {
            case OrderStatus.Shipped:
                if (!isSeller && !isAdmin)
                    throw new ApiException(403, "forbidden", "Chỉ người bán hoặc Admin mới được chuyển sang trạng thái Shipped.");
                if (string.IsNullOrWhiteSpace(order.ShippingAddress))
                    throw new ApiException(409, "missing_shipping_address", "Chưa có địa chỉ nhận hàng từ người mua.");
                order.Status = OrderStatus.Shipped;
                db.Notifications.Add(new Notification
                {
                    UserId = order.BuyerId,
                    Title = "Đơn hàng đang được giao",
                    Message = $"Người bán đã gửi sản phẩm '{order.Product.Name}' (Đơn #{order.Id}).",
                    CreatedAt = DateTime.UtcNow
                });
                break;

            case OrderStatus.Completed:
                if (!isBuyer && !isAdmin)
                    throw new ApiException(403, "forbidden", "Chỉ người mua hoặc Admin mới được xác nhận hoàn tất đơn hàng.");
                if (!isAdmin && order.Status == OrderStatus.Pending)
                    throw new ApiException(409, "order_not_ready", "Vui lòng cập nhật địa chỉ và chờ giao hàng trước khi hoàn tất đơn.");
                order.Status = OrderStatus.Completed;
                order.CompletedAt = DateTime.UtcNow;
                db.Notifications.Add(new Notification
                {
                    UserId = order.SellerId,
                    Title = "Đơn hàng đã hoàn tất",
                    Message = $"Đơn hàng #{order.Id} cho sản phẩm '{order.Product.Name}' đã được xác nhận hoàn tất.",
                    CreatedAt = DateTime.UtcNow
                });
                break;

            case OrderStatus.Cancelled:
                if (!isAdmin)
                    throw new ApiException(403, "forbidden", "Chỉ Admin mới có quyền hủy đơn hàng.");
                order.Status = OrderStatus.Cancelled;
                break;

            default:
                if (!isAdmin)
                    throw new ApiException(403, "forbidden", "Không thể chuyển sang trạng thái này.");
                order.Status = targetStatus;
                break;
        }

        await db.SaveChangesAsync(ct);
        return ToResponse(order);
    }

    private static IQueryable<Order> WithDetails(IQueryable<Order> query) =>
        query.Include(o => o.Product).Include(o => o.Buyer).Include(o => o.Seller);

    private static async Task<PagedResponseDto<OrderResponseDto>> PageAsync(
        IQueryable<Order> query, int page, int pageSize, CancellationToken ct)
    {
        var total = await query.CountAsync(ct);
        var items = await WithDetails(query)
            .OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);
        return new PagedResponseDto<OrderResponseDto>
        {
            Items = items.Select(ToResponse).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    private static OrderResponseDto ToResponse(Order o) => new()
    {
        Id = o.Id,
        ProductId = o.ProductId,
        ProductName = o.Product.Name,
        BuyerId = o.BuyerId,
        BuyerName = o.Buyer.Username,
        SellerId = o.SellerId,
        SellerName = o.Seller.Username,
        FinalPrice = o.FinalPrice,
        ShippingAddress = o.ShippingAddress,
        Status = o.Status.ToString(),
        CreatedAt = o.CreatedAt,
        CompletedAt = o.CompletedAt
    };
}
