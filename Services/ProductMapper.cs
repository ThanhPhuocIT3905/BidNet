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
        Name = p.Name,
        Description = p.Description,
        StartingPrice = p.StartingPrice,
        CurrentPrice = p.CurrentPrice,
        StartTime = DateTime.SpecifyKind(p.StartTime, DateTimeKind.Utc),
        EndTime = DateTime.SpecifyKind(p.EndTime, DateTimeKind.Utc),
        Status = p.Status.ToString(),
        ImageUrl = p.ImageUrl,
        Category = p.Category,
        SellerId = p.SellerId,
        SellerName = p.Seller.Username,
        WinnerId = p.WinnerId,
        WinnerName = p.Winner?.Username,
        CreatedAt = DateTime.SpecifyKind(p.CreatedAt, DateTimeKind.Utc),
        CancellationReason = p.CancellationReason
    };
}
