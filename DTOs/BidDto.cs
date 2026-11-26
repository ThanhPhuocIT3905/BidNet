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
    public string? BidderName { get; set; }
    public string? ProductName { get; set; }
    public string? ProductStatus { get; set; }
    public decimal? CurrentPrice { get; set; }
    public int? LeadingBidderId { get; set; }
    public bool IsLeading { get; set; }
    public bool IsWinner { get; set; }
    public int? WinnerId { get; set; }
}

public class MyAuctionDto
{
    public int AuctionId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductImageUrl { get; set; }
    public string AuctionType { get; set; } = "Regular";
    public string AuctionStatus { get; set; } = string.Empty;
    public string ParticipantStatus { get; set; } = string.Empty;
    public decimal StartingPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal MyHighestBid { get; set; }
    public decimal? WinningPrice { get; set; }
    public int MyBidCount { get; set; }
    public int TotalBidCount { get; set; }
    public bool IsLeading { get; set; }
    public bool IsWinner { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public DateTime LastBidAt { get; set; }
    public int? OrderId { get; set; }
    public string? CancellationReason { get; set; }
}

public class MyAuctionsSummaryDto
{
    public int Total { get; set; }
    public int Scheduled { get; set; }
    public int Leading { get; set; }
    public int Outbid { get; set; }
    public int Won { get; set; }
    public int Lost { get; set; }
    public int Unsold { get; set; }
    public int Cancelled { get; set; }
}

public class MyAuctionsResponseDto : PagedResponseDto<MyAuctionDto>
{
    public MyAuctionsSummaryDto Summary { get; set; } = new();
}

public class MyAuctionBidHistoryDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateTime BidTime { get; set; }
    public bool IsLeading { get; set; }
    public bool IsWinner { get; set; }
}

public class PublicBidDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateTime BidTime { get; set; }
    public string BidderName { get; set; } = string.Empty;
}
