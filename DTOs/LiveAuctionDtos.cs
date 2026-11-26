using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs;

public class CreateLiveEventDto
{
    [Required(ErrorMessage = "Tên sự kiện là bắt buộc"), MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    [MaxLength(2000)]
    public string? Description { get; set; }
    [MaxLength(2048)]
    public string? BannerUrl { get; set; }
    public DateTime ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public bool RegistrationOpen { get; set; } = true;
    [Range(0, 0.5, ErrorMessage = "Phí người mua phải từ 0% đến 50%.")]
    public decimal BuyerPremiumRate { get; set; }
}

public class UpdateLiveEventDto : CreateLiveEventDto { }

public class AddLiveLotDto
{
    [Range(1, int.MaxValue, ErrorMessage = "Yêu cầu đấu giá trực tiếp không hợp lệ.")]
    public int LiveAuctionRequestId { get; set; }
}

public class CreateLiveAuctionRequestDto
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }
    [Range(1000, 100000000000)]
    public decimal ProposedStartingPrice { get; set; }
    public decimal? ProposedReservePrice { get; set; }
    [Range(1, 100000000000)]
    public decimal ProposedBidIncrement { get; set; } = 1000;
    public int? PreferredEventId { get; set; }
    [MaxLength(1000)]
    public string? SellerNote { get; set; }
    public bool SellerConsent { get; set; }
}

public class UpdateLiveAuctionRequestDto
{
    [Range(1000, 100000000000)]
    public decimal ProposedStartingPrice { get; set; }
    public decimal? ProposedReservePrice { get; set; }
    [Range(1, 100000000000)]
    public decimal ProposedBidIncrement { get; set; } = 1000;
    [MaxLength(1000)]
    public string? SellerNote { get; set; }
}

public class ReviewLiveAuctionRequestDto
{
    [Range(1000, 100000000000)]
    public decimal ProposedStartingPrice { get; set; }
    public decimal? ProposedReservePrice { get; set; }
    [Range(1, 100000000000)]
    public decimal ProposedBidIncrement { get; set; }
    [MaxLength(1000)]
    public string? AdminNote { get; set; }
}

public class LiveAuctionRequestMessageDto
{
    [Required, MaxLength(1000)]
    public string Message { get; set; } = string.Empty;
}

public class LiveAuctionRequestDto
{
    public int Id { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductImageUrl { get; set; }
    public string? Category { get; set; }
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string? SellerAvatarUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal ProposedStartingPrice { get; set; }
    public decimal? ProposedReservePrice { get; set; }
    public decimal ProposedBidIncrement { get; set; }
    public int? PreferredEventId { get; set; }
    public string? PreferredEventTitle { get; set; }
    public string? SellerNote { get; set; }
    public string? AdminNote { get; set; }
    public string? RejectReason { get; set; }
    public int TermsVersion { get; set; }
    public int? AcceptedTermsVersion { get; set; }
    public DateTime? SellerConfirmedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewerName { get; set; }
    public int? ScheduledEventId { get; set; }
    public string? ScheduledEventTitle { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LiveAuctionEligibleProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? Category { get; set; }
    public decimal StartingPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal SuggestedBidIncrement { get; set; }
    public string Status { get; set; } = string.Empty;
    public string SellerName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
}

public class PlaceLiveBidDto
{
    [Range(1, 100000000000, ErrorMessage = "Giá đặt không hợp lệ.")]
    public decimal Amount { get; set; }
}

public class LiveAnnouncementDto
{
    [Required(ErrorMessage = "Nội dung thông báo là bắt buộc"), MaxLength(500)]
    public string Message { get; set; } = string.Empty;
}

public class LiveEventSummaryDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? BannerUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public bool RegistrationOpen { get; set; }
    public decimal BuyerPremiumRate { get; set; }
    public int LotCount { get; set; }
    public int SoldCount { get; set; }
    public int? CurrentLotId { get; set; }
    public int CurrentLotNumber { get; set; }
    public string? CurrentLotTitle { get; set; }
    public string? CurrentLotImageUrl { get; set; }
    public decimal? CurrentLotPrice { get; set; }
    public int ViewerCount { get; set; }
    public string? MyRegistrationStatus { get; set; }
    public string? AuctioneerName { get; set; }
}

public class LiveLotDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int ProductId { get; set; }
    public int? LiveAuctionRequestId { get; set; }
    public string? RequestCode { get; set; }
    public int LotNumber { get; set; }
    public int SequenceNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal StartingPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal? ReservePrice { get; set; }
    public decimal BidIncrement { get; set; }
    public decimal MinimumBid { get; set; }
    public decimal NextBid { get; set; }
    public decimal? HammerPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public string CallingStage { get; set; } = string.Empty;
    public DateTime? WarningAvailableAt { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public int? WinnerId { get; set; }
    public string? WinnerName { get; set; }
    public string? LeadingBidderCode { get; set; }
    public string? MyStatus { get; set; }
    public int BidCount { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public bool ReserveMet { get; set; }
}

public class LiveEventDto : LiveEventSummaryDto
{
    public int RegistrationCount { get; set; }
    public List<LiveLotDto> Lots { get; set; } = [];
}

public class LiveBidDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateTime BidTime { get; set; }
    public string BidderCode { get; set; } = string.Empty;
    public bool IsMine { get; set; }
}

public class LiveActivityDto
{
    public string Key { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public DateTime At { get; set; }
    public string Text { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
}

public class LiveSnapshotDto
{
    public LiveEventDto Event { get; set; } = null!;
    public DateTime ServerTime { get; set; }
    public string? MyRegistrationStatus { get; set; }
    public bool CanBid { get; set; }
    public List<LiveActivityDto> Activity { get; set; } = [];
    public List<LiveBidDto> RecentBids { get; set; } = [];
}

public class LiveRegistrationDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class LiveProductOptionDto
{
    public int Id { get; set; }
    public int RequestId { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal StartingPrice { get; set; }
    public decimal? ReservePrice { get; set; }
    public decimal BidIncrement { get; set; }
    public string? ImageUrl { get; set; }
    public string? Category { get; set; }
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
}
