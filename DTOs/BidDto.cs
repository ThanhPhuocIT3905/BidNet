using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class PlaceBidDto
{
    // Client chỉ gửi giá; UserId và thời điểm đặt lấy ở server.
    [Required(ErrorMessage = "Số tiền đặt giá là bắt buộc.")]
    [Range(0.01, 100000000000, ErrorMessage = "Số tiền đặt giá phải lớn hơn 0.")]
    public decimal Amount { get; set; }
}

// Dùng cho lịch sử của chính người đặt giá và kết quả sau POST.
public class BidResponseDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int UserId { get; set; }
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
