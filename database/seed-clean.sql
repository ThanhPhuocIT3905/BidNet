/* ============================================================
   BidNet - DU LIEU MAU SACH (clean seed, chay doc lap)
   ------------------------------------------------------------
   Script nay TU XOA toan bo du lieu cu roi insert lai:
     5 users, 6 danh muc, 16 san pham, 28 luot dau gia,
     3 don hang, 9 thong bao.

   Tai khoan demo (mat khau da bam PBKDF2-SHA256, 210.000 vong):
     admin        / Admin@12345   (Admin)
     seller_demo  / Demo@12345    (nguoi ban)
     bidder_demo  / Demo@12345    (nguoi mua)
     bidder_demo2 / Demo@12345    (nguoi mua)
     seller_art   / Demo@12345    (nguoi ban)

   Thoi gian dung SYSUTCDATETIME() nen du lieu luon "tuoi":
     - Active: EndTime o tuong lai, worker khong dong phien.
     - Scheduled: StartTime o tuong lai.
     - Completed: EndTime da qua, co WinnerId va don hang.
     - Cancelled: co CancellationReason.

   Cach chay:
     sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\seed-clean.sql
   ============================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ---------- 0. Xoa du lieu cu theo thu tu khoa ngoai ---------- */
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

    DECLARE @now datetime2(0) = SYSUTCDATETIME();

    /* ---------- 1. Users ---------- */
    SET IDENTITY_INSERT dbo.Users ON;
    INSERT INTO dbo.Users
        (Id, Username, Email, PhoneNumber, FullName, Balance,
         PasswordHash, PasswordSalt, Role, IsActive, CreatedAt, UpdatedAt)
    VALUES
        (1, N'admin', N'admin@bidnet.vn', N'0236 3686 251', N'Quản trị BidNet', 0,
         0x80815003291dc6ca0ba8eef2cbf0a5fd817571e8f7a013f4611c7eadf71155b4,
         0xcae9acf781c5d4cdf0af46796f649b44, N'Admin', 1, DATEADD(day, -30, @now), NULL),
        (2, N'seller_demo', N'seller@bidnet.local', N'0905 111 222', N'Nguyễn Minh Khoa', 50000000,
         0x356d7a586e4e825eab9f06e2277712be40aca8df62587eb5ff64678f790690da,
         0xea643c425a3f3777c82a10dd2501cf6f, N'User', 1, DATEADD(day, -28, @now), NULL),
        (3, N'bidder_demo', N'bidder@bidnet.local', N'0912 333 444', N'Trần Thu Hà', 30000000,
         0x547a2548bc570c0e7e4b05ead4338565df60a02556852fce8c948fefa63fab00,
         0x878d735f555649ed98b31fb61052df3c, N'User', 1, DATEADD(day, -25, @now), NULL),
        (4, N'bidder_demo2', N'bidder2@bidnet.local', N'0935 555 666', N'Lê Quang Huy', 25000000,
         0xe9828d53f21b99fd2b807c65a8722097ed041524587ae0cd8ab7b4fd4a8d0519,
         0x6113ea31f54323b8c80bc49c0a71a5a8, N'User', 1, DATEADD(day, -22, @now), NULL),
        (5, N'seller_art', N'seller.art@bidnet.local', N'0977 777 888', N'Phạm Ngọc Lan', 10000000,
         0xcffdfac1132f766350cc5001f5dcdd8ac4c96937d1688128d8763be6cd5e998e,
         0xd2c1522c7943d74862703e067729be60, N'User', 1, DATEADD(day, -20, @now), NULL);
    SET IDENTITY_INSERT dbo.Users OFF;

    /* ---------- 2. Categories ---------- */
    SET IDENTITY_INSERT dbo.Categories ON;
    INSERT INTO dbo.Categories (Id, Name, Description, CreatedAt)
    VALUES
        (1, N'Đồ điện tử & Công nghệ', N'Laptop, điện thoại, máy tính bảng và thiết bị số.', DATEADD(day, -30, @now)),
        (2, N'Đồng hồ & Trang sức', N'Đồng hồ cơ, đồng hồ thông minh và phụ kiện trang sức.', DATEADD(day, -30, @now)),
        (3, N'Nghệ thuật & Đồ sưu tầm', N'Tranh, gốm và hiện vật sưu tầm có nguồn gốc rõ ràng.', DATEADD(day, -30, @now)),
        (4, N'Xe cộ & Phụ tùng', N'Xe máy, xe đạp và phụ tùng chính hãng.', DATEADD(day, -30, @now)),
        (5, N'Gia dụng & Nội thất', N'Thiết bị nhà bếp, đồ gia dụng và nội thất.', DATEADD(day, -30, @now)),
        (6, N'Thể thao & Du lịch', N'Dụng cụ thể thao, đồ dã ngoại và phụ kiện du lịch.', DATEADD(day, -30, @now));
    SET IDENTITY_INSERT dbo.Categories OFF;

    /* ---------- 3. Products ---------- */
    SET IDENTITY_INSERT dbo.Products ON;
    INSERT INTO dbo.Products
        (Id, Name, Description, StartingPrice, CurrentPrice, StartTime, EndTime,
         Status, SellerId, WinnerId, ImageUrl, Category, CreatedAt, UpdatedAt,
         CancellationReason, CategoryId)
    VALUES
        /* --- 9 phien dang dien ra (Status = 0) --- */
        (1, N'iPhone 15 Pro Max 256GB - Nguyên seal',
         N'iPhone 15 Pro Max 256GB màu Titan Tự Nhiên, nguyên seal, chưa kích hoạt. Máy chính hãng VN/A, đầy đủ hộp và phụ kiện, bảo hành 12 tháng.',
         18000000, 19450000, DATEADD(day, -6, @now), DATEADD(day, 3, @now),
         0, 2, NULL, N'/images/products/iphone-15-pro-max.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -6, @now), DATEADD(day, -2, @now), NULL, 1),

        (2, N'MacBook Air M3 13 inch - 16GB/512GB',
         N'MacBook Air M3 13 inch, 16GB RAM, 512GB SSD, màu Midnight. Máy đẹp 99%, pin 94%, kèm sạc USB-C 35W.',
         22000000, 23500000, DATEADD(day, -4, @now), DATEADD(hour, 30, @now),
         0, 2, NULL, N'/images/products/macbook-air-m3.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -4, @now), DATEADD(day, -1, @now), NULL, 1),

        (3, N'Tai nghe chống ồn Sony WH-1000XM5',
         N'Tai nghe chống ồn Sony WH-1000XM5, đầy đủ hộp, đệm tai mới thay. Đã kiểm tra kết nối Bluetooth và chế độ chống ồn.',
         4500000, 4900000, DATEADD(day, -2, @now), DATEADD(day, 5, @now),
         0, 2, NULL, N'/images/products/sony-wh-1000xm5.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -2, @now), DATEADD(hour, -12, @now), NULL, 1),

        (4, N'Đồng hồ cơ Seiko Presage SRPB43',
         N'Đồng hồ cơ Seiko Presage SRPB43, mặt số xanh nhạt, dây da, kính Hardlex. Ảnh tham khảo model từ hãng.',
         6000000, 6800000, DATEADD(day, -3, @now), DATEADD(day, 2, @now),
         0, 5, NULL, N'/images/products/seiko-srpb43.webp', N'Đồng hồ & Trang sức',
         DATEADD(day, -3, @now), DATEADD(hour, -6, @now), NULL, 2),

        (5, N'Tranh sơn dầu Phố Hội An 60x80cm',
         N'Tranh sơn dầu vẽ phố cổ Hội An, kích thước 60x80cm, có khung gỗ. Tác phẩm gốc của họa sĩ trẻ, ký tên mặt sau.',
         8000000, 8000000, DATEADD(day, -1, @now), DATEADD(day, 7, @now),
         0, 5, NULL, N'/images/art.svg', N'Nghệ thuật & Đồ sưu tầm',
         DATEADD(day, -1, @now), DATEADD(day, -1, @now), NULL, 3),

        (6, N'Xe máy Honda Vision 2021',
         N'Honda Vision 2021, biển số Đà Nẵng, đã đi 18.000km. Xe chính chủ, bảo dưỡng định kỳ, giấy tờ đầy đủ.',
         25000000, 27500000, DATEADD(day, -5, @now), DATEADD(day, 4, @now),
         0, 2, NULL, N'/images/products/honda-vision-2021.webp', N'Xe cộ & Phụ tùng',
         DATEADD(day, -5, @now), DATEADD(hour, -8, @now), NULL, 4),

        (7, N'Bàn phím cơ Keychron Q1 Pro',
         N'Bàn phím cơ Keychron Q1 Pro, layout 75%, kết nối Bluetooth và USB-C. Vỏ nhôm, đèn nền RGB. Ảnh tham khảo phiên bản vỏ trắng, switch K Pro Red.',
        2800000, 3100000, DATEADD(day, -1, @now), DATEADD(hour, 10, @now),
         0, 2, NULL, N'/images/products/keychron-q1-pro.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -1, @now), DATEADD(hour, -5, @now), NULL, 1),

        (8, N'Nồi chiên không dầu Philips HD9252/91 4.1L',
         N'Nồi chiên không dầu Philips HD9252/91, dung tích 4,1 lít, công suất 1.400W. Ảnh tham khảo model từ hãng.',
         1200000, 1350000, DATEADD(day, -2, @now), DATEADD(day, 2, @now),
         0, 2, NULL, N'/images/products/philips-hd9252.webp', N'Gia dụng & Nội thất',
         DATEADD(day, -2, @now), DATEADD(hour, -4, @now), NULL, 5),

        (9, N'Máy ảnh Fujifilm X-T30 II kèm kit 15-45mm',
         N'Máy ảnh Fujifilm X-T30 II kèm kit 15-45mm. Máy hoạt động tốt, cảm biến sạch, kèm pin dự phòng và túi đựng.',
        15000000, 15000000, DATEADD(day, -1, @now), DATEADD(day, 6, @now),
         0, 2, NULL, N'/images/products/fujifilm-xt30-ii.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -1, @now), DATEADD(day, -1, @now), NULL, 1),

        /* --- 2 phien sap dien ra (Status = 3) --- */
        (10, N'iPhone 16 Pro 128GB - Chưa kích hoạt',
         N'iPhone 16 Pro 128GB, màu Titan Sa Mạc, chưa kích hoạt. Hàng chính hãng, bảo hành 12 tháng, giao máy vào ngày mở phiên.',
         25000000, 25000000, DATEADD(day, 1, @now), DATEADD(day, 8, @now),
         3, 2, NULL, N'/images/products/iphone-16-pro.webp', N'Đồ điện tử & Công nghệ',
         DATEADD(hour, -6, @now), DATEADD(hour, -6, @now), NULL, 1),

        (11, N'Xe đạp Trek FX 2 Disc Gen 3',
         N'Trek FX 2 Disc Gen 3, khung nhôm, phanh đĩa thủy lực. Ảnh tham khảo model; kích cỡ và tình trạng cần xác nhận trên sản phẩm thực tế.',
         9000000, 9000000, DATEADD(day, 2, @now), DATEADD(day, 9, @now),
         3, 5, NULL, N'/images/products/trek-fx2-disc.webp', N'Thể thao & Du lịch',
         DATEADD(hour, -3, @now), DATEADD(hour, -3, @now), NULL, 6),

        /* --- 4 phien da ket thuc (Status = 1) --- */
        (12, N'Laptop Dell XPS 13 9310',
         N'Laptop Dell XPS 13 9310, Core i7, 16GB RAM, 512GB SSD, màn hình 13.4 inch. Máy đẹp, pin 88%, kèm sạc zin.',
         15000000, 17200000, DATEADD(day, -10, @now), DATEADD(day, -3, @now),
         1, 2, 3, N'/images/tech.svg', N'Đồ điện tử & Công nghệ',
         DATEADD(day, -11, @now), DATEADD(day, -3, @now), NULL, 1),

        (13, N'Đồng hồ Tissot Le Locle Automatic',
         N'Đồng hồ Tissot Le Locle Automatic, mặt số bạc, dây thép. Máy Thụy Sĩ, đã bảo dưỡng, kèm hộp và thẻ bảo hành.',
         5000000, 5900000, DATEADD(day, -15, @now), DATEADD(day, -8, @now),
         1, 5, 4, N'/images/watch.svg', N'Đồng hồ & Trang sức',
         DATEADD(day, -16, @now), DATEADD(day, -8, @now), NULL, 2),

        (14, N'Bình gốm Bát Tràng men lam',
         N'Bình gốm Bát Tràng men lam, cao 45cm, vẽ tay họa tiết hoa sen. Sản phẩm nguyên vẹn, không sứt mẻ.',
         1500000, 1800000, DATEADD(day, -18, @now), DATEADD(day, -12, @now),
         1, 5, 3, N'/images/art.svg', N'Nghệ thuật & Đồ sưu tầm',
         DATEADD(day, -19, @now), DATEADD(day, -12, @now), NULL, 3),

        (15, N'Máy lọc không khí Xiaomi 4 Lite',
         N'Máy lọc không khí Xiaomi 4 Lite, lọc HEPA, phù hợp phòng 30m2. Đã dùng 6 tháng, còn bảo hành 6 tháng.',
         1800000, 1800000, DATEADD(day, -9, @now), DATEADD(day, -5, @now),
         1, 2, NULL, N'/images/products/xiaomi-air-purifier-4-lite.webp', N'Gia dụng & Nội thất',
         DATEADD(day, -10, @now), DATEADD(day, -5, @now), NULL, 5),

        /* --- 1 phien da huy (Status = 2) --- */
        (16, N'Apple Watch Series 8 41mm GPS',
         N'Apple Watch Series 8 41mm, GPS, dây silicone. Phiên bị hủy theo yêu cầu người bán để kiểm tra lại tình trạng pin.',
         6000000, 6000000, DATEADD(day, -2, @now), DATEADD(day, 3, @now),
         2, 5, NULL, N'/images/products/apple-watch-series-8.webp', N'Đồng hồ & Trang sức',
         DATEADD(day, -2, @now), DATEADD(day, -1, @now),
         N'Người bán yêu cầu hủy để kiểm tra lại tình trạng pin và phụ kiện.', 2);
    SET IDENTITY_INSERT dbo.Products OFF;

    /* ---------- 4. Bids (28 luot, gia cuoi = CurrentPrice) ---------- */
    SET IDENTITY_INSERT dbo.Bids ON;
    INSERT INTO dbo.Bids (Id, ProductId, UserId, Amount, BidTime)
    VALUES
        /* Phien 1 - iPhone 15 Pro Max */
        (1, 1, 4, 18500000, DATEADD(day, -5, @now)),
        (2, 1, 3, 19000000, DATEADD(day, -4, @now)),
        (3, 1, 4, 19450000, DATEADD(day, -2, @now)),
        /* Phien 2 - MacBook Air M3 */
        (4, 2, 3, 22500000, DATEADD(day, -3, @now)),
        (5, 2, 4, 23500000, DATEADD(day, -1, @now)),
        /* Phien 3 - Sony WH-1000XM5 */
        (6, 3, 3, 4700000, DATEADD(day, -1, @now)),
        (7, 3, 4, 4900000, DATEADD(hour, -12, @now)),
        /* Phien 4 - Seiko Presage */
        (8, 4, 4, 6200000, DATEADD(day, -2, @now)),
        (9, 4, 3, 6500000, DATEADD(day, -1, @now)),
        (10, 4, 4, 6800000, DATEADD(hour, -6, @now)),
        /* Phien 6 - Honda Vision */
        (11, 6, 3, 25500000, DATEADD(day, -4, @now)),
        (12, 6, 4, 26200000, DATEADD(day, -3, @now)),
        (13, 6, 3, 26900000, DATEADD(day, -2, @now)),
        (14, 6, 4, 27500000, DATEADD(hour, -8, @now)),
        /* Phien 7 - Keychron Q1 Pro */
        (15, 7, 4, 2900000, DATEADD(hour, -18, @now)),
        (16, 7, 3, 3100000, DATEADD(hour, -5, @now)),
        /* Phien 8 - Noi chien Philips */
        (17, 8, 3, 1250000, DATEADD(day, -1, @now)),
        (18, 8, 4, 1350000, DATEADD(hour, -4, @now)),
        /* Phien 12 - Dell XPS 13 (da ket thuc, winner = 3) */
        (19, 12, 4, 15500000, DATEADD(day, -9, @now)),
        (20, 12, 3, 16000000, DATEADD(day, -8, @now)),
        (21, 12, 4, 16400000, DATEADD(day, -6, @now)),
        (22, 12, 3, 16800000, DATEADD(day, -4, @now)),
        (23, 12, 3, 17200000, DATEADD(hour, -78, @now)),
        /* Phien 13 - Tissot Le Locle (winner = 4) */
        (24, 13, 3, 5300000, DATEADD(day, -14, @now)),
        (25, 13, 4, 5600000, DATEADD(day, -12, @now)),
        (26, 13, 4, 5900000, DATEADD(day, -9, @now)),
        /* Phien 14 - Binh gom Bat Trang (winner = 3) */
        (27, 14, 4, 1650000, DATEADD(day, -16, @now)),
        (28, 14, 3, 1800000, DATEADD(day, -13, @now));
    SET IDENTITY_INSERT dbo.Bids OFF;

    /* ---------- 5. Orders (toi da 1 don / san pham) ---------- */
    SET IDENTITY_INSERT dbo.Orders ON;
    INSERT INTO dbo.Orders
        (Id, ProductId, BuyerId, SellerId, FinalPrice, ShippingAddress,
         Status, CreatedAt, CompletedAt)
    VALUES
        (1, 12, 3, 2, 17200000, N'12 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
         1, DATEADD(minute, 10, DATEADD(day, -3, @now)), NULL),
        (2, 13, 4, 5, 5900000, N'45 Lê Duẩn, Hải Châu, Đà Nẵng',
         2, DATEADD(minute, 10, DATEADD(day, -8, @now)), DATEADD(day, -6, @now)),
        (3, 14, 3, 5, 1800000, N'88 Trần Phú, Hải Châu, Đà Nẵng',
         3, DATEADD(minute, 10, DATEADD(day, -12, @now)), DATEADD(day, -11, @now));
    SET IDENTITY_INSERT dbo.Orders OFF;

    /* ---------- 6. Notifications ---------- */
    SET IDENTITY_INSERT dbo.Notifications ON;
    INSERT INTO dbo.Notifications (Id, UserId, Title, Message, IsRead, CreatedAt)
    VALUES
        (1, 3, N'Bạn đã thắng phiên đấu giá',
         N'Chúc mừng! Bạn là người thắng phiên #12 - Laptop Dell XPS 13 9310 với giá 17.200.000 ₫.',
         0, DATEADD(minute, 12, DATEADD(day, -3, @now))),
        (2, 3, N'Đơn hàng mới',
         N'Đơn hàng #1 cho phiên #12 đã được tạo ở trạng thái Chờ xử lý. Vui lòng cập nhật địa chỉ giao hàng.',
         0, DATEADD(minute, 15, DATEADD(day, -3, @now))),
        (3, 2, N'Sản phẩm đã có người thắng',
         N'Phiên #12 - Laptop Dell XPS 13 9310 đã kết thúc với giá 17.200.000 ₫.',
         1, DATEADD(minute, 16, DATEADD(day, -3, @now))),
        (4, 4, N'Giá của bạn đã bị vượt',
         N'Phiên #12 - Laptop Dell XPS 13 9310 vừa có lượt đặt giá cao hơn của bạn.',
         0, DATEADD(hour, -78, @now)),
        (5, 4, N'Bạn đã thắng phiên đấu giá',
         N'Bạn đã thắng phiên #13 - Đồng hồ Tissot Le Locle với giá 5.900.000 ₫.',
         1, DATEADD(minute, 12, DATEADD(day, -8, @now))),
        (6, 2, N'Đơn hàng đã giao',
         N'Đơn hàng #2 cho phiên #13 đã được đánh dấu Đã giao.',
         1, DATEADD(day, -6, @now)),
        (7, 3, N'Giá của bạn đã bị vượt',
         N'Phiên #1 - iPhone 15 Pro Max vừa có lượt đặt giá 19.450.000 ₫.',
         0, DATEADD(day, -2, @now)),
        (8, 4, N'Phiên sắp kết thúc',
         N'Phiên #4 - Đồng hồ Seiko Presage còn khoảng 2 ngày. Đừng bỏ lỡ.',
         0, DATEADD(hour, -1, @now)),
        (9, 2, N'Phiên sắp mở',
         N'Phiên #10 - iPhone 16 Pro 128GB sẽ mở sau khoảng 1 ngày.',
         0, DATEADD(hour, -2, @now));
    SET IDENTITY_INSERT dbo.Notifications OFF;

    /* ---------- 7. Dua identity ve gia tri lon nhat ---------- */
    DBCC CHECKIDENT ('dbo.Users', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Categories', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Products', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Bids', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Orders', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Notifications', RESEED) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.ProductImages', RESEED) WITH NO_INFOMSGS;

    COMMIT TRANSACTION;

    PRINT N'[BidNet] Seed sach hoan tat: 5 users, 6 categories, 16 products, 28 bids, 3 orders, 9 notifications.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    PRINT N'[BidNet] Seed that bai: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

/* ---------- 8. Kiem tra nhanh ---------- */
SELECT 'Users' AS Bang, COUNT(*) AS SoDong FROM dbo.Users
UNION ALL SELECT 'Categories', COUNT(*) FROM dbo.Categories
UNION ALL SELECT 'Products', COUNT(*) FROM dbo.Products
UNION ALL SELECT 'Bids', COUNT(*) FROM dbo.Bids
UNION ALL SELECT 'Orders', COUNT(*) FROM dbo.Orders
UNION ALL SELECT 'Notifications', COUNT(*) FROM dbo.Notifications
UNION ALL SELECT 'ProductImages', COUNT(*) FROM dbo.ProductImages;
