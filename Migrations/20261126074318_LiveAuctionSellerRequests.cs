using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class LiveAuctionSellerRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AuctionType",
                table: "Products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AddedById",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LiveAuctionRequestId",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LiveAuctionRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestCode = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    SellerId = table.Column<int>(type: "int", nullable: false),
                    Source = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ProposedStartingPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProposedReservePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ProposedBidIncrement = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PreferredEventId = table.Column<int>(type: "int", nullable: true),
                    SellerNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AdminNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RejectReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ReviewedById = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SellerConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TermsVersion = table.Column<int>(type: "int", nullable: false),
                    AcceptedTermsVersion = table.Column<int>(type: "int", nullable: true),
                    ScheduledEventId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveAuctionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LiveAuctionRequests_LiveEvents_PreferredEventId",
                        column: x => x.PreferredEventId,
                        principalTable: "LiveEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveAuctionRequests_LiveEvents_ScheduledEventId",
                        column: x => x.ScheduledEventId,
                        principalTable: "LiveEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveAuctionRequests_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveAuctionRequests_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveAuctionRequests_Users_SellerId",
                        column: x => x.SellerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_AuctionType",
                table: "Products",
                sql: "[AuctionType] IN (0,1)");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_AddedById",
                table: "LiveLots",
                column: "AddedById");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots",
                column: "LiveAuctionRequestId",
                unique: true,
                filter: "[LiveAuctionRequestId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_PreferredEventId",
                table: "LiveAuctionRequests",
                column: "PreferredEventId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_ProductId",
                table: "LiveAuctionRequests",
                column: "ProductId",
                unique: true,
                filter: "[Status] IN (0, 1, 2, 3, 4, 7, 8)");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_RequestCode",
                table: "LiveAuctionRequests",
                column: "RequestCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_ReviewedById",
                table: "LiveAuctionRequests",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_ScheduledEventId",
                table: "LiveAuctionRequests",
                column: "ScheduledEventId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_SellerId",
                table: "LiveAuctionRequests",
                column: "SellerId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveAuctionRequests_Status_CreatedAt",
                table: "LiveAuctionRequests",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_LiveLots_LiveAuctionRequests_LiveAuctionRequestId",
                table: "LiveLots",
                column: "LiveAuctionRequestId",
                principalTable: "LiveAuctionRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LiveLots_Users_AddedById",
                table: "LiveLots",
                column: "AddedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LiveLots_LiveAuctionRequests_LiveAuctionRequestId",
                table: "LiveLots");

            migrationBuilder.DropForeignKey(
                name: "FK_LiveLots_Users_AddedById",
                table: "LiveLots");

            migrationBuilder.DropTable(
                name: "LiveAuctionRequests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_AuctionType",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_LiveLots_AddedById",
                table: "LiveLots");

            migrationBuilder.DropIndex(
                name: "IX_LiveLots_LiveAuctionRequestId",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "AuctionType",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "AddedById",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "LiveAuctionRequestId",
                table: "LiveLots");
        }
    }
}
