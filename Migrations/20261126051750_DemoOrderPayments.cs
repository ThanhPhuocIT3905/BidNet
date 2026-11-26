using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class DemoOrderPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "Orders",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentStatus",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                "UPDATE [Orders] SET [PaymentStatus] = 1 WHERE [Status] IN (1, 2)");

            migrationBuilder.AddColumn<string>(
                name: "PaymentTransactionId",
                table: "Orders",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PaymentTransactionId",
                table: "Orders",
                column: "PaymentTransactionId",
                unique: true,
                filter: "[PaymentTransactionId] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_PaymentMethod",
                table: "Orders",
                sql: "[PaymentMethod] IS NULL OR [PaymentMethod] IN ('BANK_TRANSFER_DEMO','MOMO_DEMO')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_PaymentStatus",
                table: "Orders",
                sql: "[PaymentStatus] IN (0,1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_PaymentTransactionId",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_PaymentMethod",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_PaymentStatus",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentTransactionId",
                table: "Orders");
        }
    }
}
