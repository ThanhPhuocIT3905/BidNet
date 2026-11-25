using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class OrderResponseDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
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

public class UpdateShippingAddressDto
{
    [Required(ErrorMessage = "Địa chỉ nhận hàng không được để trống"), MaxLength(500)]
    public string ShippingAddress { get; set; } = string.Empty;
}

public class UpdateOrderStatusDto
{
    [Required(ErrorMessage = "Trạng thái đơn hàng không được để trống")]
    public string Status { get; set; } = string.Empty;
}
