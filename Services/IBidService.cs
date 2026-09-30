using BidNet.DTOs;

namespace BidNet.Services;

// Hợp đồng đấu giá: đặt giá và đọc lịch sử công khai/cá nhân.
public interface IBidService
{
    Task<BidResponseDto> PlaceAsync(int productId, decimal amount, CancellationToken ct);
    Task<PagedResponseDto<PublicBidDto>> ForProductAsync(int productId, int page, int pageSize, CancellationToken ct);
    Task<PagedResponseDto<BidResponseDto>> MineAsync(int page, int pageSize, CancellationToken ct);
}
