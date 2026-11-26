using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

// Phân hệ đấu giá trực tiếp: một sự kiện gồm nhiều lô (lot) được mở lần lượt.
// Sản phẩm của lô vẫn là Product hiện có để tái dùng ảnh, người bán và đơn hàng.
[Table("LiveEvents")]
public class LiveEvent
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(2048)]
    public string? BannerUrl { get; set; }

    public LiveEventStatus Status { get; set; } = LiveEventStatus.Draft;

    // Giờ UTC; sự kiện do người điều hành mở/chốt nên đây chỉ là lịch dự kiến.
    public DateTime ScheduledStartAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }

    // Người bán có thể đăng ký trước khi sự kiện diễn ra.
    public bool RegistrationOpen { get; set; } = true;

    // Tỷ lệ phí người mua, chỉ để hiển thị; đơn hàng hiện lưu giá chốt.
    [Column(TypeName = "decimal(5,4)")]
    public decimal BuyerPremiumRate { get; set; }

    public LiveOperationMode OperationMode { get; set; } = LiveOperationMode.Manual;
    public int DefaultLotDurationSeconds { get; set; } = 300;
    public bool AutoStartEvent { get; set; }
    public bool AutoOpenFirstLot { get; set; }
    public bool AutoCloseLots { get; set; }
    public bool AutoOpenNextLot { get; set; }
    public bool AutoCompleteEvent { get; set; }
    public int InterLotDelaySeconds { get; set; } = 30;
    public bool AutoExtensionEnabled { get; set; }
    public int ExtensionTriggerSeconds { get; set; } = 15;
    public int ExtensionSeconds { get; set; } = 30;
    public int MaxExtensions { get; set; } = 3;
    public bool AllowLateLotAddition { get; set; }
    public DateTime? NextLotOpenAt { get; set; }
    public DateTime? PausedAt { get; set; }

    public int? CurrentLotId { get; set; }

    public int CreatedById { get; set; }
    [ForeignKey(nameof(CreatedById))]
    public virtual User CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];

    public virtual ICollection<LiveLot> Lots { get; set; } = new List<LiveLot>();
    public virtual ICollection<LiveRegistration> Registrations { get; set; } = new List<LiveRegistration>();
}

public enum LiveOperationMode
{
    Manual = 0,
    Automatic = 1,
    Hybrid = 2
}

public enum LiveEventStatus
{
    Draft = 0,
    Published = 1,
    Live = 2,
    Paused = 3,
    Completed = 4,
    Cancelled = 5
}

[Table("LiveLots")]
public class LiveLot
{
    [Key]
    public int Id { get; set; }

    public int EventId { get; set; }
    [ForeignKey(nameof(EventId))]
    public virtual LiveEvent Event { get; set; } = null!;

    // Mỗi sản phẩm chỉ được đưa vào tối đa một lô để không bán hai lần.
    public int ProductId { get; set; }
    [ForeignKey(nameof(ProductId))]
    public virtual Product Product { get; set; } = null!;

    public int? LiveAuctionRequestId { get; set; }
    [ForeignKey(nameof(LiveAuctionRequestId))]
    public virtual LiveAuctionRequest? LiveAuctionRequest { get; set; }

    public int? AddedById { get; set; }
    [ForeignKey(nameof(AddedById))]
    public virtual User? AddedBy { get; set; }

    public int SellerId { get; set; }
    [ForeignKey(nameof(SellerId))]
    public virtual User Seller { get; set; } = null!;

    // Thứ tự mở lô; LotNumber dùng để hiển thị "Lô 012".
    public int SequenceNumber { get; set; }
    public int LotNumber { get; set; }

    // Bản chụp thông tin tại thời điểm xếp lô, tránh thay đổi sản phẩm làm sai lịch sử.
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    [MaxLength(2000)]
    public string? Description { get; set; }
    [MaxLength(2048)]
    public string? ImageUrl { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal StartingPrice { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal CurrentPrice { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal? ReservePrice { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal BidIncrement { get; set; } = 1000;

    public LiveLotStatus Status { get; set; } = LiveLotStatus.Pending;
    public LiveOperationMode? OperationModeOverride { get; set; }
    public int? DurationSeconds { get; set; }
    public LiveCallingStage CallingStage { get; set; } = LiveCallingStage.None;
    public DateTime? LastWarningAt { get; set; }

    public int? LeadingBidderId { get; set; }
    [ForeignKey(nameof(LeadingBidderId))]
    public virtual User? LeadingBidder { get; set; }

    public int? WinnerId { get; set; }
    [ForeignKey(nameof(WinnerId))]
    public virtual User? Winner { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? HammerPrice { get; set; }

    public int BidCount { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? OriginalEndAt { get; set; }
    public DateTime? CurrentEndAt { get; set; }
    public int? RemainingSecondsOnPause { get; set; }
    public int ExtensionCount { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedById { get; set; }
    [ForeignKey(nameof(ClosedById))]
    public virtual User? ClosedBy { get; set; }
    public LiveLotCloseMethod? CloseMethod { get; set; }

    [MaxLength(500)]
    public string? WithdrawReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];

    public virtual ICollection<LiveBid> Bids { get; set; } = new List<LiveBid>();
}

public enum LiveLotStatus
{
    Pending = 0,
    Open = 1,
    Paused = 2,
    Sold = 3,
    Unsold = 4,
    Skipped = 5,
    Withdrawn = 6,
    AwaitingConfirmation = 7
}

public enum LiveLotCloseMethod
{
    Manual = 0,
    Automatic = 1,
    HybridConfirmed = 2
}

public enum LiveCallingStage
{
    None = 0,
    Once = 1,
    Twice = 2
}

[Table("LiveBids")]
public class LiveBid
{
    [Key]
    public int Id { get; set; }

    public int LotId { get; set; }
    [ForeignKey(nameof(LotId))]
    public virtual LiveLot Lot { get; set; } = null!;

    public int UserId { get; set; }
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    public DateTime BidTime { get; set; } = DateTime.UtcNow;
}

[Table("LiveRegistrations")]
public class LiveRegistration
{
    [Key]
    public int Id { get; set; }

    public int EventId { get; set; }
    [ForeignKey(nameof(EventId))]
    public virtual LiveEvent Event { get; set; } = null!;

    public int UserId { get; set; }
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public LiveRegistrationStatus Status { get; set; } = LiveRegistrationStatus.Approved;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum LiveRegistrationStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Suspended = 3,
    Withdrawn = 4
}
