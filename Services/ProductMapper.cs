using BidNet.DTOs;
using BidNet.Models;

namespace BidNet.Services;

public static class ProductMapper
{
    // Chỉ chép trường dùng cho response. Seller/Winner phải được Include trước;
    // nếu không, Seller.Username không có dữ liệu để hiển thị.
    public static ProductResponseDto ToResponse(Product p) => new()
    {
        Id = p.Id,
        Version = Convert.ToBase64String(p.RowVersion),
        Name = p.Name,
        Description = p.Description,
        StartingPrice = p.StartingPrice,
        CurrentPrice = p.CurrentPrice,
        StartTime = p.StartTime,
        EndTime = p.EndTime,
        Status = p.Status.ToString(),
        AuctionType = p.AuctionType.ToString(),
        ImageUrl = p.ImageUrl,
        Category = p.Category,
        CategoryId = p.CategoryId,
        BidCount = p.Bids?.Count ?? 0,
        SellerId = p.SellerId,
        SellerName = p.Seller.Username,
        SellerAvatarUrl = p.Seller.AvatarUrl,
        SellerJoinedAt = p.Seller.CreatedAt,
        WinnerId = p.WinnerId,
        WinnerName = p.Winner?.Username,
        CreatedAt = p.CreatedAt,
        CancellationReason = p.CancellationReason
    };
}
