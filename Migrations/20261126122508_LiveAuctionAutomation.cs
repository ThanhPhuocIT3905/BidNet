using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class LiveAuctionAutomation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_LiveLots_Status",
                table: "LiveLots");

            migrationBuilder.AddColumn<int>(
                name: "CloseMethod",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ClosedById",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CurrentEndAt",
                table: "LiveLots",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExtensionCount",
                table: "LiveLots",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OperationModeOverride",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OriginalEndAt",
                table: "LiveLots",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RemainingSecondsOnPause",
                table: "LiveLots",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowLateLotAddition",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoCloseLots",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoCompleteEvent",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoExtensionEnabled",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoOpenFirstLot",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoOpenNextLot",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoStartEvent",
                table: "LiveEvents",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "DefaultLotDurationSeconds",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 300);

            migrationBuilder.AddColumn<int>(
                name: "ExtensionSeconds",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<int>(
                name: "ExtensionTriggerSeconds",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 15);

            migrationBuilder.AddColumn<int>(
                name: "InterLotDelaySeconds",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<int>(
                name: "MaxExtensions",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextLotOpenAt",
                table: "LiveEvents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OperationMode",
                table: "LiveEvents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "LiveEvents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_ClosedById",
                table: "LiveLots",
                column: "ClosedById");

            migrationBuilder.CreateIndex(
                name: "IX_LiveLots_Status_CurrentEndAt",
                table: "LiveLots",
                columns: new[] { "Status", "CurrentEndAt" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_LiveLots_DurationSeconds",
                table: "LiveLots",
                sql: "[DurationSeconds] IS NULL OR [DurationSeconds] BETWEEN 60 AND 604800");

            migrationBuilder.AddCheckConstraint(
                name: "CK_LiveLots_Status",
                table: "LiveLots",
                sql: "[Status] IN (0,1,2,3,4,5,6,7)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_LiveEvents_DurationSeconds",
                table: "LiveEvents",
                sql: "[DefaultLotDurationSeconds] BETWEEN 60 AND 604800");

            migrationBuilder.AddCheckConstraint(
                name: "CK_LiveEvents_InterLotDelaySeconds",
                table: "LiveEvents",
                sql: "[InterLotDelaySeconds] BETWEEN 0 AND 3600");

            migrationBuilder.AddForeignKey(
                name: "FK_LiveLots_Users_ClosedById",
                table: "LiveLots",
                column: "ClosedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LiveLots_Users_ClosedById",
                table: "LiveLots");

            migrationBuilder.DropIndex(
                name: "IX_LiveLots_ClosedById",
                table: "LiveLots");

            migrationBuilder.DropIndex(
                name: "IX_LiveLots_Status_CurrentEndAt",
                table: "LiveLots");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LiveLots_DurationSeconds",
                table: "LiveLots");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LiveLots_Status",
                table: "LiveLots");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LiveEvents_DurationSeconds",
                table: "LiveEvents");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LiveEvents_InterLotDelaySeconds",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "CloseMethod",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "ClosedById",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "CurrentEndAt",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "ExtensionCount",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "OperationModeOverride",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "OriginalEndAt",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "RemainingSecondsOnPause",
                table: "LiveLots");

            migrationBuilder.DropColumn(
                name: "AllowLateLotAddition",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoCloseLots",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoCompleteEvent",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoExtensionEnabled",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoOpenFirstLot",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoOpenNextLot",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "AutoStartEvent",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "DefaultLotDurationSeconds",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "ExtensionSeconds",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "ExtensionTriggerSeconds",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "InterLotDelaySeconds",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "MaxExtensions",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "NextLotOpenAt",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "OperationMode",
                table: "LiveEvents");

            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "LiveEvents");

            migrationBuilder.AddCheckConstraint(
                name: "CK_LiveLots_Status",
                table: "LiveLots",
                sql: "[Status] IN (0,1,2,3,4,5,6)");
        }
    }
}
