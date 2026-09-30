using BidNet.DTOs;

namespace BidNet.Services;

// Hợp đồng nghiệp vụ sản phẩm: đọc công khai, tạo/sửa theo tài khoản đăng nhập.
public interface IProductService
{
    Task<PagedResponseDto<ProductResponseDto>> ListAsync(ProductQueryDto query, CancellationToken ct);
    Task<PagedResponseDto<ProductResponseDto>> MineAsync(int page, int pageSize, CancellationToken ct);
    Task<ProductResponseDto> GetAsync(int id, CancellationToken ct);
    Task<ProductResponseDto> CreateAsync(CreateProductDto request, CancellationToken ct);
    Task<ProductResponseDto> UpdateAsync(int id, UpdateProductDto request, CancellationToken ct);
}
