using System.ComponentModel.DataAnnotations;
using BidNet.Models;

namespace BidNet.DTOs;

// DTO trả về chi tiết đơn hàng sau đấu giá
public class OrderResponseDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductImageUrl { get; set; }
    public int BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public decimal FinalPrice { get; set; }
    public string? ShippingAddress { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

// DTO người thắng cập nhật địa chỉ giao hàng
public class UpdateShippingAddressDto
{
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ nhận hàng.")]
    [MaxLength(500, ErrorMessage = "Địa chỉ tối đa 500 ký tự.")]
    public string ShippingAddress { get; set; } = string.Empty;
}

// DTO cập nhật trạng thái đơn hàng (Paid, Delivered, Cancelled)
public class UpdateOrderStatusDto
{
    [Required(ErrorMessage = "Vui lòng chọn trạng thái đơn hàng.")]
    public OrderStatus Status { get; set; }
}
