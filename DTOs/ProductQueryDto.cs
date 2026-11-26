namespace BidNet.DTOs;

public class ProductQueryDto
{
    // Các giá trị đến từ query string GET /api/products; PageArgs.Validate
    // kiểm Page/PageSize trước khi đưa vào Skip/Take của EF.
    public string? Q { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }

    // Sắp xếp danh sách công khai: newest | ending_soon | most_bids | price_asc | price_desc.
    // Giá trị lạ dùng mặc định newest thay vì trả lỗi để URL cũ vẫn hoạt động.
    public string? Sort { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
