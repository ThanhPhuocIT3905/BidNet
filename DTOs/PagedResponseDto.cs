namespace BidNet.DTOs;

public class PagedResponseDto<T>
{
    // TotalCount là tổng kết quả sau lọc, trước khi lấy trang hiện tại.
    public IReadOnlyList<T> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
