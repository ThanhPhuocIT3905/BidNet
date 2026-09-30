using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Data.Migrations
{
    /// <inheritdoc />
    public partial class AuctionWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bids_ProductId",
                table: "Bids");

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Products",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Products",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            // Giữ dữ liệu cũ: phiên chưa mở thành Scheduled, giá chưa có bid về StartingPrice.
            migrationBuilder.Sql("""
                UPDATE p
                SET p.CurrentPrice = p.StartingPrice
                FROM Products AS p
                WHERE NOT EXISTS (SELECT 1 FROM Bids AS b WHERE b.ProductId = p.Id);

                UPDATE p
                SET p.Status = 3
                FROM Products AS p
                WHERE p.Status = 0 AND p.StartTime > SYSUTCDATETIME()
                  AND NOT EXISTS (SELECT 1 FROM Bids AS b WHERE b.ProductId = p.Id);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Products_Status_StartTime_EndTime",
                table: "Products",
                columns: new[] { "Status", "StartTime", "EndTime" });

            migrationBuilder.CreateIndex(
                name: "IX_Bids_ProductId_BidTime",
                table: "Bids",
                columns: new[] { "ProductId", "BidTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_Status_StartTime_EndTime",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Bids_ProductId_BidTime",
                table: "Bids");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Bids_ProductId",
                table: "Bids",
                column: "ProductId");
        }
    }
}
