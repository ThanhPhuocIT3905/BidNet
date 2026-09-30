using System.ComponentModel.DataAnnotations;

namespace BidNet.DTOs
{
    // ================= BID DTOs =================

    public class CreateBidDto
    {
        [Required(ErrorMessage = "ProductId là bắt buộc")]
        public int ProductId { get; set; }

        [Required(ErrorMessage = "Số tiền đấu giá là bắt buộc")]
        [Range(1, double.MaxValue, ErrorMessage = "Số tiền đấu giá phải lớn hơn 0")]
        public decimal Amount { get; set; }
    }

    public class UpdateBidDto
    {
        [Required(ErrorMessage = "Số tiền đấu giá là bắt buộc")]
        [Range(1, double.MaxValue, ErrorMessage = "Số tiền đấu giá phải lớn hơn 0")]
        public decimal Amount { get; set; }
    }

    public class BidResponseDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime BidTime { get; set; }
    }
}
