namespace BidNet.Services;

public static class PageArgs
{
    // Hàm chung cho các API danh sách để cùng giới hạn tối đa 100 dòng/trang.
    public static (int Page, int PageSize) Validate(int page, int pageSize)
    {
        // Chặn trang quá lớn và phép nhân Skip bị tràn số nguyên.
        if (page < 1 || pageSize < 1 || pageSize > 100 ||
            (long)(page - 1) * pageSize > int.MaxValue)
            throw new ApiException(400, "invalid_pagination", "Page phải từ 1, PageSize từ 1 đến 100.");
        return (page, pageSize);
    }
}
