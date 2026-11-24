using BidNet.Data;
using BidNet.DTOs;
using BidNet.Exceptions;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Controllers;

[ApiController]
[Authorize] // Bắt buộc đăng nhập
[Route("api/[controller]")]
public class OrdersController(AppDbContext db, CurrentUser currentUser) : ControllerBase
{
    // READ ME: Lấy danh sách đơn hàng liên quan đến tài khoản hiện tại (Đơn mình thắng hoặc mình bán)
    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<OrderResponseDto>>> GetMyOrders(CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.BuyerId == user.Id || o.SellerId == user.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderResponseDto
            {
                Id = o.Id,
                ProductId = o.ProductId,
                ProductName = o.Product.Name,
                ProductImageUrl = o.Product.ImageUrl,
                BuyerId = o.BuyerId,
                BuyerName = o.Buyer.FullName ?? o.Buyer.Username,
                SellerId = o.SellerId,
                SellerName = o.Seller.FullName ?? o.Seller.Username,
                FinalPrice = o.FinalPrice,
                ShippingAddress = o.ShippingAddress,
                Status = o.Status.ToString(),
                CreatedAt = o.CreatedAt,
                CompletedAt = o.CompletedAt
            })
            .ToListAsync(ct);

        return Ok(orders);
    }

    // READ ONE: Xem chi tiết đơn hàng theo ID (Chỉ Buyer, Seller hoặc Admin mới được xem)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Product)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng ID {id}.");

        // Kiểm tra quyền: Người mua, người bán hoặc Admin mới được xem
        if (order.BuyerId != user.Id && order.SellerId != user.Id && user.Role != "Admin")
            throw new UnauthorizedException("Bạn không có quyền truy cập vào đơn hàng này.");

        return Ok(new OrderResponseDto
        {
            Id = order.Id,
            ProductId = order.ProductId,
            ProductName = order.Product.Name,
            ProductImageUrl = order.Product.ImageUrl,
            BuyerId = order.BuyerId,
            BuyerName = order.Buyer.FullName ?? order.Buyer.Username,
            SellerId = order.SellerId,
            SellerName = order.Seller.FullName ?? order.Seller.Username,
            FinalPrice = order.FinalPrice,
            ShippingAddress = order.ShippingAddress,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            CompletedAt = order.CompletedAt
        });
    }

    // UPDATE: Người mua (thắng đấu giá) cập nhật địa chỉ giao hàng
    [HttpPatch("{id:int}/shipping-address")]
    public async Task<ActionResult<OrderResponseDto>> UpdateShippingAddress(int id, [FromBody] UpdateShippingAddressDto dto, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var order = await db.Orders
            .Include(o => o.Product)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng ID {id}.");

        // Chỉ người thắng cuộc (Buyer) mới có quyền cập nhật địa chỉ của mình
        if (order.BuyerId != user.Id)
            throw new UnauthorizedException("Chỉ người mua mới có quyền cập nhật địa chỉ giao hàng.");

        order.ShippingAddress = dto.ShippingAddress.Trim();
        await db.SaveChangesAsync(ct);

        return Ok(new OrderResponseDto
        {
            Id = order.Id,
            ProductId = order.ProductId,
            ProductName = order.Product.Name,
            ProductImageUrl = order.Product.ImageUrl,
            BuyerId = order.BuyerId,
            BuyerName = order.Buyer.FullName ?? order.Buyer.Username,
            SellerId = order.SellerId,
            SellerName = order.Seller.FullName ?? order.Seller.Username,
            FinalPrice = order.FinalPrice,
            ShippingAddress = order.ShippingAddress,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            CompletedAt = order.CompletedAt
        });
    }

    // UPDATE STATUS: Cập nhật trạng thái đơn hàng (Paid, Delivered, Cancelled)
    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<OrderResponseDto>> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);

        var order = await db.Orders
            .Include(o => o.Product)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng ID {id}.");

        // Người bán hoặc Admin mới được đổi trạng thái đơn
        if (order.SellerId != user.Id && user.Role != "Admin")
            throw new UnauthorizedException("Chỉ người bán hoặc Admin mới có quyền cập nhật trạng thái đơn hàng.");

        order.Status = dto.Status;
        if (dto.Status == OrderStatus.Delivered)
        {
            order.CompletedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        return Ok(new OrderResponseDto
        {
            Id = order.Id,
            ProductId = order.ProductId,
            ProductName = order.Product.Name,
            ProductImageUrl = order.Product.ImageUrl,
            BuyerId = order.BuyerId,
            BuyerName = order.Buyer.FullName ?? order.Buyer.Username,
            SellerId = order.SellerId,
            SellerName = order.Seller.FullName ?? order.Seller.Username,
            FinalPrice = order.FinalPrice,
            ShippingAddress = order.ShippingAddress,
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            CompletedAt = order.CompletedAt
        });
    }
}
