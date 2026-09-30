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
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
