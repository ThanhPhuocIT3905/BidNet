/* ============================================================
   BidNet - XOA TOAN BO DU LIEU (reset all data)
   ------------------------------------------------------------
   - Xoa sach 7 bang nghiep vu: Notifications, Orders, Bids,
     ProductImages, Products, Categories, Users.
   - Dua identity cua moi bang ve 1 cho lan insert ke tiep.
   - Chay trong transaction: loi o bat ky buoc nao se rollback.
   - KHONG dong toi schema/migration.

   Cach chay (PowerShell):
     sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\reset-all-data.sql

   Sau khi chay, chay tiep:
     sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\seed-clean.sql
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* Thu tu xoa phai ton trong khoa ngoai:
       Notifications -> Orders -> Bids -> ProductImages -> Products
       -> Categories -> Users. */
    DELETE FROM dbo.Notifications;
    DELETE FROM dbo.SupportMessages;
    DELETE FROM dbo.SupportTickets;
    DELETE FROM dbo.OrderEvents;
    DELETE FROM dbo.AdminAuditLogs;
    DELETE FROM dbo.Orders;
    DELETE FROM dbo.Bids;
    DELETE FROM dbo.ProductImages;
    DELETE FROM dbo.Products;
    DELETE FROM dbo.Categories;
    DELETE FROM dbo.Users;

    /* RESEED 0: ban ghi tiep theo se co Id = 1. */
    DBCC CHECKIDENT ('dbo.Notifications', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Orders', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Bids', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.ProductImages', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Products', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Categories', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Users', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT TRANSACTION;
    PRINT N'[BidNet] Da xoa toan bo du lieu 7 bang.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    PRINT N'[BidNet] Xoa du lieu that bai: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
