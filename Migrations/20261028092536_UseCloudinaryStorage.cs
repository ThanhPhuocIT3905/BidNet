using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Data.Migrations
{
    /// <inheritdoc />
    public partial class UseCloudinaryStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Content",
                table: "ProductImages");

            migrationBuilder.AddColumn<string>(
                name: "CloudinaryPublicId",
                table: "ProductImages",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CloudinaryUrl",
                table: "ProductImages",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CloudinaryPublicId",
                table: "ProductImages");

            migrationBuilder.DropColumn(
                name: "CloudinaryUrl",
                table: "ProductImages");

            migrationBuilder.AddColumn<byte[]>(
                name: "Content",
                table: "ProductImages",
                type: "varbinary(max)",
                nullable: false,
                defaultValue: new byte[0]);
        }
    }
}
