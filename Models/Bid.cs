using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BidNet.Models
{
    public class Bid
    {
        // Một dòng là một lượt trả giá, nối với sản phẩm và người đặt giá.
        // Giá thắng cuối cùng được worker suy ra từ các dòng bid này.
        [Key]
        public int Id { get; set; }

        [Required]
        public int ProductId { get; set; }

        [ForeignKey(nameof(ProductId))]
        public virtual Product Product { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        // Lưu UTC để so sánh và hiển thị nhất quán giữa các máy.
        public DateTime BidTime { get; set; } = DateTime.UtcNow;
    }
}
