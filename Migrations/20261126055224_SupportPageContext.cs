using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class SupportPageContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PageContext",
                table: "SupportTickets",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LiveEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    BannerUrl = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ScheduledStartAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ScheduledEndAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RegistrationOpen = table.Column<bool>(type: "bit", nullable: false),
                    BuyerPremiumRate = table.Column<decimal>(type: "decimal(5,4)", nullable: false),
                    CurrentLotId = table.Column<int>(type: "int", nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LiveEvents_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LiveLots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    SellerId = table.Column<int>(type: "int", nullable: false),
                    SequenceNumber = table.Column<int>(type: "int", nullable: false),
                    LotNumber = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    StartingPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CurrentPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReservePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    BidIncrement = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CallingStage = table.Column<int>(type: "int", nullable: false),
                    LeadingBidderId = table.Column<int>(type: "int", nullable: true),
                    WinnerId = table.Column<int>(type: "int", nullable: true),
                    HammerPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    BidCount = table.Column<int>(type: "int", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WithdrawReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveLots", x => x.Id);
                    table.CheckConstraint("CK_LiveLots_Status", "[Status] IN (0,1,2,3,4,5,6)");
                    table.ForeignKey(
                        name: "FK_LiveLots_LiveEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "LiveEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LiveLots_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveLots_Users_LeadingBidderId",
                        column: x => x.LeadingBidderId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveLots_Users_SellerId",
                        column: x => x.SellerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveLots_Users_WinnerId",
                        column: x => x.WinnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LiveRegistrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveRegistrations", x => x.Id);
                    table.CheckConstraint("CK_LiveRegistrations_Status", "[Status] IN (0,1,2,3,4)");
                    table.ForeignKey(
                        name: "FK_LiveRegistrations_LiveEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "LiveEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LiveRegistrations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LiveBids",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LotId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BidTime = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiveBids", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LiveBids_LiveLots_LotId",
                        column: x => x.LotId,
                        principalTable: "LiveLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiveBids_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LiveBids_LotId_Amount_BidTime",
                table: "LiveBids",
                columns: new[] { "LotId", "Amount", "BidTime" });

            migrationBuilder.CreateIndex(
                name: "IX_LiveBids_UserId",
                table: "LiveBids",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveEvents_Code",
                table: "LiveEvents",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveEvents_CreatedById",
                table: "LiveEvents",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_LiveEvents_Status_ScheduledStartAt",
                table: "LiveEvents",
                columns: new[] { "Status", "ScheduledStartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_EventId_SequenceNumber",
                table: "LiveLots",
                columns: new[] { "EventId", "SequenceNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_LeadingBidderId",
                table: "LiveLots",
                column: "LeadingBidderId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_ProductId",
                table: "LiveLots",
                column: "ProductId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_SellerId",
                table: "LiveLots",
                column: "SellerId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_Status_EventId",
                table: "LiveLots",
                columns: new[] { "Status", "EventId" });

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_WinnerId",
                table: "LiveLots",
                column: "WinnerId");

            migrationBuilder.CreateIndex(
                name: "IX_LiveRegistrations_EventId_UserId",
                table: "LiveRegistrations",
                columns: new[] { "EventId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveRegistrations_UserId",
                table: "LiveRegistrations",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LiveBids");

            migrationBuilder.DropTable(
                name: "LiveRegistrations");

            migrationBuilder.DropTable(
                name: "LiveLots");

            migrationBuilder.DropTable(
                name: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "PageContext",
                table: "SupportTickets");
        }
    }
}
