using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class ProductService(AppDbContext db, CurrentUser currentUser) : IProductService
{
    // Danh sách công khai: lọc ở SQL rồi mới phân trang, tránh kéo cả bảng về RAM.
    public async Task<PagedResponseDto<ProductResponseDto>> ListAsync(ProductQueryDto filter, CancellationToken ct)
    {
        // AsNoTracking phù hợp với màn hình chỉ đọc: EF không cần theo dõi thay đổi.
        var (page, size) = PageArgs.Validate(filter.Page, filter.PageSize);
        var query = db.Products.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(filter.Q))
            query = query.Where(p => p.Name.Contains(filter.Q.Trim()));
        if (!string.IsNullOrWhiteSpace(filter.Category))
            query = query.Where(p => p.Category == filter.Category.Trim());
        // Chỉ nhận đúng giá trị enum; chuỗi lạ phải báo 400 thay vì trả danh sách rỗng.
        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            if (!Enum.TryParse<ProductStatus>(filter.Status, true, out var status) ||
                !Enum.IsDefined(status))
                throw new ApiException(400, "invalid_status", "Trạng thái không hợp lệ.");
            query = query.Where(p => p.Status == status);
        }
        // Bộ lọc giá áp vào CurrentPrice (giá đang hiển thị), không phải StartingPrice.
        if (filter.MinPrice is < 0 || filter.MaxPrice is < 0 ||
            filter.MinPrice > filter.MaxPrice)
            throw new ApiException(400, "invalid_price_range", "Khoảng giá không hợp lệ.");
        if (filter.MinPrice.HasValue)
            query = query.Where(p => p.CurrentPrice >= filter.MinPrice);
        if (filter.MaxPrice.HasValue)
            query = query.Where(p => p.CurrentPrice <= filter.MaxPrice);
        return await PageAsync(query, page, size, ct);
    }

    // Lấy danh sách sản phẩm do chính tài khoản trong token đăng bán.
    public async Task<PagedResponseDto<ProductResponseDto>> MineAsync(int page, int pageSize, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        return await PageAsync(db.Products.AsNoTracking().Where(p => p.SellerId == user.Id),
            args.Page, args.PageSize, ct);
    }

    // Nạp Seller/Winner để DTO có tên người bán và người thắng, không chỉ ID.
    public async Task<ProductResponseDto> GetAsync(int id, CancellationToken ct)
    {
        var product = await WithUsers(db.Products.AsNoTracking())
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        return ProductMapper.ToResponse(product);
    }

    public async Task<ProductResponseDto> CreateAsync(CreateProductDto request, CancellationToken ct)
    {
        // SellerId luôn lấy từ token; client không thể đăng bán hộ người khác.
        // Phiên mới ở Scheduled và CurrentPrice ban đầu bằng StartingPrice.
        var user = await currentUser.RequireActiveAsync(ct);
        Validate(request.Name, request.StartingPrice, request.StartTime, request.EndTime, request.ImageUrl);
        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            StartingPrice = request.StartingPrice,
            CurrentPrice = request.StartingPrice,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            ImageUrl = request.ImageUrl,
            Category = request.Category?.Trim(),
            SellerId = user.Id,
            Seller = user,
            Status = ProductStatus.Scheduled
        };
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return ProductMapper.ToResponse(product);
    }

    public async Task<ProductResponseDto> UpdateAsync(int id, UpdateProductDto request, CancellationToken ct)
    {
        // Chỉ chủ sản phẩm được sửa trước giờ bắt đầu. Điều kiện "chưa có bid"
        // giữ nguyên cam kết với người đã đặt giá nếu dữ liệu trạng thái bị lệch.
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await db.Products.Include(p => p.Seller)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        if (product.SellerId != user.Id)
            throw new ApiException(403, "not_owner", "Bạn không phải người bán sản phẩm này.");
        if (product.Status != ProductStatus.Scheduled || product.StartTime <= DateTime.UtcNow ||
            await db.Bids.AnyAsync(b => b.ProductId == id, ct))
            throw new ApiException(409, "auction_started", "Không thể sửa phiên đã bắt đầu hoặc đã có giá.");
        Validate(request.Name, request.StartingPrice, request.StartTime, request.EndTime, request.ImageUrl);
        product.Name = request.Name.Trim();
        product.Description = request.Description?.Trim();
        product.StartingPrice = request.StartingPrice;
        product.CurrentPrice = request.StartingPrice;
        product.StartTime = request.StartTime;
        product.EndTime = request.EndTime;
        product.ImageUrl = request.ImageUrl;
        product.Category = request.Category?.Trim();
        product.UpdatedAt = DateTime.UtcNow;
        // RowVersion làm SaveChanges thất bại nếu worker/request khác vừa đổi phiên.
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "product_changed", "Phiên đã thay đổi, hãy tải lại.");
        }
        return ProductMapper.ToResponse(product);
    }

    // Mapper dùng Seller.Username và Winner.Username nên truy vấn phải Include trước.
    private static IQueryable<Product> WithUsers(IQueryable<Product> query) =>
        query.Include(p => p.Seller).Include(p => p.Winner);

    private static async Task<PagedResponseDto<ProductResponseDto>> PageAsync(
        IQueryable<Product> query, int page, int size, CancellationToken ct)
    {
        // Đếm trước Skip/Take để TotalCount là tổng số bản ghi sau lọc.
        // Id là tiêu chí phụ khi CreatedAt trùng nhau, giúp trang có thứ tự ổn định.
        var count = await query.CountAsync(ct);
        var products = await WithUsers(query).OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResponseDto<ProductResponseDto>
        {
            Items = products.Select(ProductMapper.ToResponse).ToList(),
            Page = page,
            PageSize = size,
            TotalCount = count
        };
    }

    private static void Validate(string name, decimal price, DateTime start, DateTime end, string? imageUrl)
    {
        // Dùng VND nguyên; decimal(18,2) lưu được nhưng nghiệp vụ không nhận lẻ.
        // UTC giúp so sánh thời điểm đúng khi các thành viên chạy khác múi giờ.
        if (string.IsNullOrWhiteSpace(name))
            throw new ApiException(400, "invalid_name", "Tên sản phẩm không được trống.");
        if (price < 1000 || price != decimal.Truncate(price) || price > 9_999_999_999_999_999m)
            throw new ApiException(400, "invalid_price", "Giá khởi điểm phải là số nguyên VND từ 1.000.");
        if (start.Kind != DateTimeKind.Utc || end.Kind != DateTimeKind.Utc ||
            start <= DateTime.UtcNow || end <= start)
            throw new ApiException(400, "invalid_time", "Thời gian phải là UTC, bắt đầu trong tương lai và kết thúc sau khi bắt đầu.");
        if (!string.IsNullOrWhiteSpace(imageUrl) &&
            (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) ||
             (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
            throw new ApiException(400, "invalid_image_url", "URL ảnh phải dùng HTTP hoặc HTTPS.");
    }
}
