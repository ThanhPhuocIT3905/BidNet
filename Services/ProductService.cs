using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public class ProductService(AppDbContext db, CurrentUser currentUser, IConfiguration config) : IProductService
{
    // Danh sách công khai: lọc ở SQL rồi mới phân trang, tránh kéo cả bảng về RAM.
    public async Task<PagedResponseDto<ProductResponseDto>> ListAsync(ProductQueryDto filter, CancellationToken ct)
    {
        // AsNoTracking phù hợp với màn hình chỉ đọc: EF không cần theo dõi thay đổi.
        var (page, size) = PageArgs.Validate(filter.Page, filter.PageSize);
        // Sản phẩm đã được xếp vào lô đấu giá trực tiếp không xuất hiện như
        // phiên đấu giá theo thời gian để tránh bán trùng.
        var query = db.Products.AsNoTracking()
            .Where(p => !db.LiveLots.Any(l => l.ProductId == p.Id &&
                l.Status != LiveLotStatus.Unsold && l.Status != LiveLotStatus.Skipped &&
                l.Status != LiveLotStatus.Withdrawn));
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

        // Sắp xếp ở SQL trước khi phân trang. Giá trị không nhận diện được quay về "mới nhất"
        // để link cũ hoặc tham số sai không làm hỏng trang danh sách.
        var ordered = (filter.Sort ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "ending_soon" => query.OrderBy(p => p.EndTime).ThenBy(p => p.Id),
            "most_bids" => query.OrderByDescending(p => p.Bids.Count).ThenByDescending(p => p.CreatedAt),
            "price_asc" => query.OrderBy(p => p.CurrentPrice).ThenBy(p => p.Id),
            "price_desc" => query.OrderByDescending(p => p.CurrentPrice).ThenBy(p => p.Id),
            "oldest" => query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
        };
        return await PageAsync(ordered, page, size, ct);
    }

    // Lấy danh sách sản phẩm do chính tài khoản trong token đăng bán.
    public async Task<PagedResponseDto<ProductResponseDto>> MineAsync(int page, int pageSize, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var args = PageArgs.Validate(page, pageSize);
        return await PageAsync(
            db.Products.AsNoTracking().Where(p => p.SellerId == user.Id)
                .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
            args.Page, args.PageSize, ct);
    }

    // Nạp Seller/Winner để DTO có tên người bán và người thắng, không chỉ ID.
    public async Task<ProductResponseDto> GetAsync(int id, CancellationToken ct)
    {
        var product = await WithUsers(db.Products.AsNoTracking())
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        var response = ProductMapper.ToResponse(product);
        var increment = config.GetValue<decimal>("Auction:MinBidIncrement");
        if (increment < 1 || increment != decimal.Truncate(increment))
            throw new InvalidOperationException("Auction:MinBidIncrement phải là số nguyên VND dương.");
        response.MinBidIncrement = increment;
        var leadingBid = await db.Bids.AsNoTracking()
            .Where(b => b.ProductId == id)
            .OrderByDescending(b => b.Amount).ThenBy(b => b.BidTime).ThenBy(b => b.Id)
            .Select(b => new { b.UserId })
            .FirstOrDefaultAsync(ct);
        response.BidCount = await db.Bids.CountAsync(b => b.ProductId == id, ct);
        response.MinimumBid = response.BidCount > 0
            ? product.CurrentPrice + increment : product.StartingPrice;
        response.LeadingBidderName = leadingBid is null
            ? null
            : await db.Users.AsNoTracking()
                .Where(user => user.Id == leadingBid.UserId)
                .Select(user => user.Username)
                .FirstOrDefaultAsync(ct);
        return response;
    }

    public async Task<ProductResponseDto> CreateAsync(CreateProductDto request, CancellationToken ct)
    {
        // SellerId luôn lấy từ token; client không thể đăng bán hộ người khác.
        // Phiên mới ở Scheduled và CurrentPrice ban đầu bằng StartingPrice.
        var user = await currentUser.RequireMemberAsync(ct);
        Validate(request.Name, request.StartingPrice, request.StartTime, request.EndTime, request.ImageUrl);
        // Danh mục phải tồn tại; nếu chỉ gửi tên (dữ liệu cũ) thì cố gắng khớp
        // với bảng Categories để giữ nhất quán giữa CategoryId và tên danh mục.
        var category = await ResolveCategoryAsync(request.CategoryId, request.Category, ct);
        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            StartingPrice = request.StartingPrice,
            CurrentPrice = request.StartingPrice,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            ImageUrl = request.ImageUrl,
            Category = category?.Name ?? request.Category?.Trim(),
            CategoryId = category?.Id ?? request.CategoryId,
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
        var user = await currentUser.RequireMemberAsync(ct);
        var product = await db.Products.Include(p => p.Seller)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");
        if (product.SellerId != user.Id)
            throw new ApiException(403, "not_owner", "Bạn không phải người bán sản phẩm này.");
        VersionGuard.Check(request.Version, product.RowVersion);
        if (product.Status != ProductStatus.Scheduled || product.StartTime <= DateTime.UtcNow ||
            await db.Bids.AnyAsync(b => b.ProductId == id, ct))
            throw new ApiException(409, "auction_started", "Không thể sửa phiên đã bắt đầu hoặc đã có giá.");
        Validate(request.Name, request.StartingPrice, request.StartTime, request.EndTime,
            request.ImageUrl == product.ImageUrl ? null : request.ImageUrl);
        var category = await ResolveCategoryAsync(request.CategoryId, request.Category, ct);
        product.Name = request.Name.Trim();
        product.Description = request.Description?.Trim();
        product.StartingPrice = request.StartingPrice;
        product.CurrentPrice = request.StartingPrice;
        product.StartTime = request.StartTime;
        product.EndTime = request.EndTime;
        product.ImageUrl = request.ImageUrl;
        product.Category = category?.Name ?? request.Category?.Trim();
        product.CategoryId = category?.Id ?? request.CategoryId;
        product.UpdatedAt = DateTime.UtcNow;
        // RowVersion làm SaveChanges thất bại nếu worker/request khác vừa đổi phiên.
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "product_changed", "Phiên đã thay đổi, hãy tải lại.");
        }
        return ProductMapper.ToResponse(product);
    }

    public async Task<ProductResponseDto> CancelAsync(int id, string reason, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await WithUsers(db.Products)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");

        if (product.SellerId != user.Id && user.Role != "Admin")
            throw new ApiException(403, "forbidden", "Bạn không có quyền hủy phiên đấu giá này.");

        if (product.Status is ProductStatus.Completed or ProductStatus.Cancelled)
            throw new ApiException(400, "invalid_status", "Không thể hủy phiên đấu giá đã kết thúc hoặc đã hủy.");

        var hasBids = await db.Bids.AnyAsync(b => b.ProductId == id, ct);
        if (user.Role != "Admin" && product.Status == ProductStatus.Active && hasBids)
            throw new ApiException(400, "cannot_cancel_active_bids", "Phiên đang diễn ra và đã có người đặt giá. Vui lòng liên hệ Admin để hỗ trợ hủy phiên.");

        product.Status = ProductStatus.Cancelled;
        product.CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Người bán hủy phiên đấu giá." : reason.Trim();
        product.UpdatedAt = DateTime.UtcNow;

        db.Notifications.Add(new Notification
        {
            UserId = product.SellerId,
            ProductId = id,
            Title = "Phiên đấu giá đã hủy",
            Message = $"Phiên '{product.Name}' đã được hủy. Lý do: {product.CancellationReason}",
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
        return ProductMapper.ToResponse(product);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var user = await currentUser.RequireActiveAsync(ct);
        var product = await db.Products.Include(p => p.Bids)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new ApiException(404, "product_not_found", "Không tìm thấy sản phẩm.");

        if (product.SellerId != user.Id && user.Role != "Admin")
            throw new ApiException(403, "forbidden", "Bạn không có quyền xóa sản phẩm này.");

        if (product.Bids.Count > 0)
            throw new ApiException(400, "cannot_delete_with_bids", "Không thể xóa sản phẩm đã có lịch sử đặt giá.");

        if (product.Status == ProductStatus.Active)
            throw new ApiException(400, "cannot_delete_active", "Không thể xóa phiên đấu giá đang diễn ra.");

        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);
    }

    // Mapper dùng Seller.Username và Winner.Username nên truy vấn phải Include trước.
    // Xác định danh mục hợp lệ: ưu tiên CategoryId, sau đó khớp theo tên.
    // Trả null nếu client chỉ gửi chuỗi danh mục tự do (tương thích dữ liệu cũ).
    private async Task<Category?> ResolveCategoryAsync(int? categoryId, string? categoryName, CancellationToken ct)
    {
        if (categoryId is int id)
        {
            return await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new ApiException(400, "category_not_found", $"Không tìm thấy danh mục ID {id}.");
        }
        if (!string.IsNullOrWhiteSpace(categoryName))
        {
            var name = categoryName.Trim();
            return await db.Categories.FirstOrDefaultAsync(c => c.Name == name, ct)
                ?? throw new ApiException(400, "category_not_found", "Danh mục không tồn tại.");
        }
        return null;
    }

    private static IQueryable<Product> WithUsers(IQueryable<Product> query) =>
        query.Include(p => p.Seller).Include(p => p.Winner).Include(p => p.Bids);

    private static async Task<PagedResponseDto<ProductResponseDto>> PageAsync(
        IOrderedQueryable<Product> query, int page, int size, CancellationToken ct)
    {
        // Đếm trước Skip/Take để TotalCount là tổng số bản ghi sau lọc.
        // Thứ tự do ListAsync/MineAsync quyết định, không sắp xếp lại ở đây.
        var count = await query.CountAsync(ct);
        var products = await WithUsers(query)
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
        if (price < 1000 || price != decimal.Truncate(price) || price > 100_000_000_000m)
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
