using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BidNet.Migrations
{
    /// <inheritdoc />
    public partial class SyncCategoriesOrdersNotificationsImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migration an toàn (idempotent): tạo bảng/cột/index/FK nếu chưa tồn tại,
            // hoạt động cả trên DB tạo mới lẫn BidNetDb đã import từ script SQL.
            migrationBuilder.Sql("""
                IF COL_LENGTH('dbo.Products', 'CategoryId') IS NULL
                    ALTER TABLE [dbo].[Products] ADD [CategoryId] int NULL;

                IF OBJECT_ID('dbo.Categories', 'U') IS NULL
                CREATE TABLE [dbo].[Categories] (
                    [Id] int NOT NULL IDENTITY,
                    [Name] nvarchar(100) NOT NULL,
                    [Description] nvarchar(500) NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_Categories] PRIMARY KEY ([Id])
                );

                IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
                CREATE TABLE [dbo].[Notifications] (
                    [Id] int NOT NULL IDENTITY,
                    [UserId] int NOT NULL,
                    [Title] nvarchar(200) NOT NULL,
                    [Message] nvarchar(1000) NOT NULL,
                    [IsRead] bit NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_Notifications_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
                );

                IF OBJECT_ID('dbo.Orders', 'U') IS NULL
                CREATE TABLE [dbo].[Orders] (
                    [Id] int NOT NULL IDENTITY,
                    [ProductId] int NOT NULL,
                    [BuyerId] int NOT NULL,
                    [SellerId] int NOT NULL,
                    [FinalPrice] decimal(18,2) NOT NULL,
                    [ShippingAddress] nvarchar(500) NULL,
                    [Status] int NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    [CompletedAt] datetime2 NULL,
                    CONSTRAINT [PK_Orders] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_Orders_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [dbo].[Products] ([Id]),
                    CONSTRAINT [FK_Orders_Users_BuyerId] FOREIGN KEY ([BuyerId]) REFERENCES [dbo].[Users] ([Id]),
                    CONSTRAINT [FK_Orders_Users_SellerId] FOREIGN KEY ([SellerId]) REFERENCES [dbo].[Users] ([Id])
                );

                IF OBJECT_ID('dbo.ProductImages', 'U') IS NULL
                CREATE TABLE [dbo].[ProductImages] (
                    [Id] int NOT NULL IDENTITY,
                    [FileName] nvarchar(255) NOT NULL,
                    [ContentType] nvarchar(100) NOT NULL,
                    [Length] bigint NOT NULL,
                    [UploadedAt] datetime2 NOT NULL,
                    [ProductId] int NULL,
                    [CloudinaryPublicId] nvarchar(500) NOT NULL DEFAULT N'',
                    [CloudinaryUrl] nvarchar(1000) NOT NULL DEFAULT N'',
                    CONSTRAINT [PK_ProductImages] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_ProductImages_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [dbo].[Products] ([Id]) ON DELETE SET NULL
                );

                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Products_Categories_CategoryId')
                    ALTER TABLE [dbo].[Products] ADD CONSTRAINT [FK_Products_Categories_CategoryId]
                    FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE SET NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_CategoryId' AND object_id = OBJECT_ID('dbo.Products'))
                    CREATE INDEX [IX_Products_CategoryId] ON [dbo].[Products] ([CategoryId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_UserId_IsRead_CreatedAt' AND object_id = OBJECT_ID('dbo.Notifications'))
                    CREATE INDEX [IX_Notifications_UserId_IsRead_CreatedAt] ON [dbo].[Notifications] ([UserId], [IsRead], [CreatedAt]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_BuyerId' AND object_id = OBJECT_ID('dbo.Orders'))
                    CREATE INDEX [IX_Orders_BuyerId] ON [dbo].[Orders] ([BuyerId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_ProductId' AND object_id = OBJECT_ID('dbo.Orders'))
                    CREATE INDEX [IX_Orders_ProductId] ON [dbo].[Orders] ([ProductId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_SellerId' AND object_id = OBJECT_ID('dbo.Orders'))
                    CREATE INDEX [IX_Orders_SellerId] ON [dbo].[Orders] ([SellerId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductImages_ProductId' AND object_id = OBJECT_ID('dbo.ProductImages'))
                    CREATE INDEX [IX_ProductImages_ProductId] ON [dbo].[ProductImages] ([ProductId]);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "Orders");

            migrationBuilder.DropTable(
                name: "ProductImages");

            migrationBuilder.DropIndex(
                name: "IX_Products_CategoryId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Products");
        }
    }
}
