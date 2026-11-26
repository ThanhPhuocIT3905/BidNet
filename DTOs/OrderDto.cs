using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
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
    public DateTime? PaidAt { get; set; }
    public string? RecipientName { get; set; }
    public string? RecipientPhone { get; set; }
    public string? CancellationReason { get; set; }
    public string Version { get; set; } = string.Empty;
}

// DTO người thắng cập nhật địa chỉ giao hàng
public class UpdateShippingAddressDto
{
    [MaxLength(200)] public string? RecipientName { get; set; }
    [Phone, MaxLength(20)] public string? RecipientPhone { get; set; }
    public string? Version { get; set; }
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ nhận hàng.")]
    [MaxLength(500, ErrorMessage = "Địa chỉ tối đa 500 ký tự.")]
    public string ShippingAddress { get; set; } = string.Empty;
}

// DTO cập nhật trạng thái đơn hàng (Paid, Delivered, Cancelled)
public class UpdateOrderStatusDto
{
    [MaxLength(500)] public string? Note { get; set; }
    public string? Version { get; set; }
    [Required(ErrorMessage = "Vui lòng chọn trạng thái đơn hàng.")]
    [EnumDataType(typeof(OrderStatus), ErrorMessage = "Trạng thái đơn hàng không hợp lệ.")]
    [JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))]
    public OrderStatus Status { get; set; }
}

public record OrderEventDto(int Id, string Action, string? FromStatus, string ToStatus,
    string ActorName, string? Note, DateTime CreatedAt);
