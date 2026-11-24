using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

// Bảng lưu đơn hàng sinh ra sau khi phiên đấu giá kết thúc thành công.
// Khép kín chu trình: Đấu giá -> Có người thắng -> Tạo đơn hàng -> Giao nhận.
[Table("Orders")]
public class Order
{
    [Key]
    public int Id { get; set; }

    // Sản phẩm đấu giá tương ứng (Mỗi sản phẩm chỉ sinh tối đa 1 đơn hàng)
    public int ProductId { get; set; }
    [ForeignKey("ProductId")]
    public virtual Product Product { get; set; } = null!;

    // Người thắng cuộc (Người mua)
    public int BuyerId { get; set; }
    [ForeignKey("BuyerId")]
    public virtual User Buyer { get; set; } = null!;

    // Người đăng bán (Người bán)
    public int SellerId { get; set; }
    [ForeignKey("SellerId")]
    public virtual User Seller { get; set; } = null!;

    // Giá chốt phiên đấu giá
    [Column(TypeName = "decimal(18,2)")]
    public decimal FinalPrice { get; set; }

    // Địa chỉ nhận hàng của người mua
    [MaxLength(500)]
    public string? ShippingAddress { get; set; }

    // Trạng thái đơn hàng: Chờ xử lý -> Đã thanh toán -> Đã giao hàng -> Đã hủy
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public enum OrderStatus
{
    Pending = 0,    // Chờ xác nhận & thanh toán
    Paid = 1,       // Người mua đã thanh toán
    Delivered = 2,  // Đã giao hàng thành công
    Cancelled = 3   // Đơn hàng bị hủy
}
