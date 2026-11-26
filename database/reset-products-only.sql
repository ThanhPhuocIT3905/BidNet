/* ============================================================
   BidNet - CHI XOA DU LIEU SAN PHAM (reset products only)
   ------------------------------------------------------------
   - Xoa Orders, Bids, ProductImages, Products.
   - GIU NGUYEN Users va Categories de tai khoan/danh muc
     van dang nhap va hoat dong binh thuong.
   - Dua identity cua 4 bang vua xoa ve 1.

   Dung khi:
   - Muon lam lai danh sach phien dau gia nhung giu tai khoan.
   - Muon xoa san pham cu de nhap lai bang tay qua giao dien.

   Luu y: Orders bi xoa truoc Products vi FK Orders.ProductId
   la NO_ACTION. ProductImages co FK SET_NULL nhung van xoa
   truoc de tranh anh mo coi.

   Cach chay:
     sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\reset-products-only.sql

   Script nay KHONG tao du lieu mau. Sau khi chay, dung giao
   dien hoac API de dang san pham moi. Neu muon du lieu mau
   day du, hay dung reset-all-data.sql + seed-clean.sql.
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE dbo.Notifications SET OrderId = NULL, ProductId = NULL;
    UPDATE dbo.SupportTickets SET OrderId = NULL, ProductId = NULL;
    DELETE FROM dbo.OrderEvents;
    DELETE FROM dbo.AdminAuditLogs WHERE EntityType IN ('Order', 'Product');
    DELETE FROM dbo.Orders;
    DELETE FROM dbo.Bids;
    DELETE FROM dbo.ProductImages;
    DELETE FROM dbo.Products;

    DBCC CHECKIDENT ('dbo.Orders', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Bids', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.ProductImages', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Products', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT TRANSACTION;
    PRINT N'[BidNet] Da xoa san pham, luot dau gia, don hang va anh. Users/Categories duoc giu nguyen.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    PRINT N'[BidNet] Xoa du lieu san pham that bai: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
