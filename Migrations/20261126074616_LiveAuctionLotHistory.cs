using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class LiveAuctionLotHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots",
                column: "LiveAuctionRequestId",
                unique: true,
                filter: "[Status] IN (0, 1, 2, 3) AND [LiveAuctionRequestId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots",
                column: "LiveAuctionRequestId",
                unique: true,
                filter: "[LiveAuctionRequestId] IS NOT NULL");
        }
    }
}
