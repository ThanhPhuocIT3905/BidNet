using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class LiveAuctionsSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LiveLots_ProductId",
                table: "LiveLots");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_ProductId",
                table: "LiveLots",
                column: "ProductId",
                unique: true,
                filter: "[Status] IN (0, 1, 2, 3)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LiveLots_ProductId",
                table: "LiveLots");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_ProductId",
                table: "LiveLots",
                column: "ProductId",
                unique: true);
        }
    }
}
