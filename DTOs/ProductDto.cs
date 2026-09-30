using System.ComponentModel.DataAnnotations;
using BidNet.Models;

namespace BidNet.DTOs
{
    // DTO là hợp đồng HTTP: chỉ chứa trường client được gửi/nhận,
    // không đưa thẳng entity EF ra API.

    // Dữ liệu client gửi để tạo phiên; SellerId/Status do server tự quyết định.
    public class CreateProductDto
    {
        [Required(ErrorMessage = "Tên sản phẩm không được để trống"), MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [Required(ErrorMessage = "Giá khởi điểm là bắt buộc")]
        [Range(1000, 100000000000, ErrorMessage = "Giá khởi điểm không hợp lệ")]
        public decimal StartingPrice { get; set; }

        // Gửi thời gian ISO-8601 có Z (UTC); service kiểm bắt đầu trong tương lai.
        [Required(ErrorMessage = "Thời gian bắt đầu là bắt buộc")]
        public DateTime StartTime { get; set; }

        [Required(ErrorMessage = "Thời gian kết thúc là bắt buộc")]
        public DateTime EndTime { get; set; }

        [MaxLength(2048)]
        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }
    }

    // Khi sửa, service chỉ chấp nhận phiên Scheduled chưa bắt đầu/chưa có bid.
    public class UpdateProductDto
    {
        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(2048)]
        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }
        public decimal StartingPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }

    // Dữ liệu trả về để client hiển thị; không bao gồm RowVersion hay entity User.
    public class ProductResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal StartingPrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public string? Category { get; set; }

        public int SellerId { get; set; }
        public string SellerName { get; set; } = string.Empty;

        // WinnerId/Name null trước khi có kết quả hoặc phiên không có người thắng.
        public int? WinnerId { get; set; }
        public string? WinnerName { get; set; }

        public DateTime CreatedAt { get; set; }
        public string? CancellationReason { get; set; }
    }
}
