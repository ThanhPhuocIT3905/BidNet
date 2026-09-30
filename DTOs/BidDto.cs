using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

// ================= BID DTOs =================

public class CreateBidDto
{
    [Required(ErrorMessage = "ProductId là bắt buộc")]
    public int ProductId { get; set; }

    [Required(ErrorMessage = "Số tiền đấu giá là bắt buộc")]
    [Range(1, double.MaxValue, ErrorMessage = "Số tiền đấu giá phải lớn hơn 0")]
    public decimal Amount { get; set; }
}

public class UpdateBidDto
{
    [Required(ErrorMessage = "Số tiền đấu giá là bắt buộc")]
    [Range(1, double.MaxValue, ErrorMessage = "Số tiền đấu giá phải lớn hơn 0")]
    public decimal Amount { get; set; }
}

public class PlaceBidDto
{
    // Client chỉ gửi giá; UserId và thời điểm đặt lấy ở server.
    public decimal Amount { get; set; }
}

// Dùng cho lịch sử của chính người đặt giá và kết quả sau POST.
public class BidResponseDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime BidTime { get; set; }
}

public class PublicBidDto
{
    // Lịch sử công khai bỏ UserId để không tiết lộ người đang đấu giá.
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateTime BidTime { get; set; }
}
