using System.ComponentModel.DataAnnotations;
using BidNet.Models;

namespace BidNet.DTOs
{
    // ================= PRODUCT DTOs =================

    public class CreateProductDto
    {
        [Required(ErrorMessage = "Tên sản phẩm không được để trống"), MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [Required(ErrorMessage = "Giá khởi điểm là bắt buộc")]
        [Range(1000, 100000000000, ErrorMessage = "Giá khởi điểm không hợp lệ")]
        public decimal StartingPrice { get; set; }

        [Required(ErrorMessage = "Thời gian bắt đầu là bắt buộc")]
        public DateTime StartTime { get; set; }

        [Required(ErrorMessage = "Thời gian kết thúc là bắt buộc")]
        public DateTime EndTime { get; set; }

        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }
    }

    public class UpdateProductDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }

        [MaxLength(2000)]
        public string? Description { get; set; }

        public string? ImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }
    }

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

        public int? WinnerId { get; set; }
        public string? WinnerName { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}