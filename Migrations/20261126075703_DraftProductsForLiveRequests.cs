using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class DraftProductsForLiveRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_Status",
                table: "Products");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_Status",
                table: "Products",
                sql: "[Status] IN (0,1,2,3,4)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_Status",
                table: "Products");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_Status",
                table: "Products",
                sql: "[Status] IN (0,1,2,3)");
        }
    }
}
