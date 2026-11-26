using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models;

[Table("LiveAuctionRequests")]
public class LiveAuctionRequest
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(48)]
    public string RequestCode { get; set; } = string.Empty;

    public int ProductId { get; set; }
    [ForeignKey(nameof(ProductId))]
    public virtual Product Product { get; set; } = null!;

    public int SellerId { get; set; }
    [ForeignKey(nameof(SellerId))]
    public virtual User Seller { get; set; } = null!;

    public LiveAuctionRequestSource Source { get; set; } = LiveAuctionRequestSource.Seller;
    public LiveAuctionRequestStatus Status { get; set; } = LiveAuctionRequestStatus.PendingReview;

    [Column(TypeName = "decimal(18,2)")]
    public decimal ProposedStartingPrice { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ProposedReservePrice { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal ProposedBidIncrement { get; set; }

    public int? PreferredEventId { get; set; }
    [ForeignKey(nameof(PreferredEventId))]
    public virtual LiveEvent? PreferredEvent { get; set; }

    [MaxLength(1000)]
    public string? SellerNote { get; set; }

    [MaxLength(1000)]
    public string? AdminNote { get; set; }

    [MaxLength(500)]
    public string? RejectReason { get; set; }

    public int? ReviewedById { get; set; }
    [ForeignKey(nameof(ReviewedById))]
    public virtual User? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }
    public DateTime? SellerConfirmedAt { get; set; }
    public int TermsVersion { get; set; } = 1;
    public int? AcceptedTermsVersion { get; set; }
    public int? ScheduledEventId { get; set; }
    [ForeignKey(nameof(ScheduledEventId))]
    public virtual LiveEvent? ScheduledEvent { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];

    public virtual LiveLot? Lot { get; set; }
}

public enum LiveAuctionRequestSource
{
    Seller = 0,
    AdminInvitation = 1
}

public enum LiveAuctionRequestStatus
{
    PendingReview = 0,
    Reviewing = 1,
    RevisionRequested = 2,
    AwaitingSellerConfirmation = 3,
    Approved = 4,
    Rejected = 5,
    Withdrawn = 6,
    Scheduled = 7,
    Live = 8,
    Completed = 9
}
