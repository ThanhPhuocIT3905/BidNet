-- Dữ liệu mẫu phục vụ test trọn luồng trên Swagger (chạy lại an toàn - idempotent)
-- Mật khẩu chung cho cả 4 tài khoản mẫu: Password123!
USE [BidNetDb];
GO

DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

-- 1. Tài khoản mẫu (Admin, Seller, Bidder1, Bidder2)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = N'swagger_admin')
INSERT [dbo].[Users] ([Username], [Email], [PhoneNumber], [FullName], [Balance], [PasswordHash], [PasswordSalt], [Role], [IsActive], [CreatedAt], [UpdatedAt])
VALUES (N'swagger_admin', N'swagger_admin@bidnet.vn', N'0901000001', N'Swagger Admin Demo', 0, 0x4FA4EF404994410954D2A35C8373F3F6CDBB1474FBCCDC66BE102017CA6CD1A1, 0x0C46DDC811B18EF0FA587F67D10C7E25, N'Admin', 1, @NowUtc, NULL);

IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = N'swagger_seller')
INSERT [dbo].[Users] ([Username], [Email], [PhoneNumber], [FullName], [Balance], [PasswordHash], [PasswordSalt], [Role], [IsActive], [CreatedAt], [UpdatedAt])
VALUES (N'swagger_seller', N'swagger_seller@bidnet.vn', N'0901000002', N'Swagger Seller Demo', 0, 0x5C4DD0AD0988B3024801220FBF30083A406574F5E7D18BC7042E0AAE5AE723B8, 0xDC0F1B4485F39A2BE4EC235F3F9A2333, N'User', 1, @NowUtc, NULL);

IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = N'swagger_bidder1')
INSERT [dbo].[Users] ([Username], [Email], [PhoneNumber], [FullName], [Balance], [PasswordHash], [PasswordSalt], [Role], [IsActive], [CreatedAt], [UpdatedAt])
VALUES (N'swagger_bidder1', N'swagger_bidder1@bidnet.vn', N'0901000003', N'Swagger Bidder 1', 0, 0x2AE413D01147DA0B38FE878E8BDF7D2DB1E65FBCD21B9833469689F481559F60, 0xA11F003B70E18CF1E69CDC786BD42864, N'User', 1, @NowUtc, NULL);

IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = N'swagger_bidder2')
INSERT [dbo].[Users] ([Username], [Email], [PhoneNumber], [FullName], [Balance], [PasswordHash], [PasswordSalt], [Role], [IsActive], [CreatedAt], [UpdatedAt])
VALUES (N'swagger_bidder2', N'swagger_bidder2@bidnet.vn', N'0901000004', N'Swagger Bidder 2', 0, 0xF0C4BF839850D4EBCB59CDE3F6EE98ACD2DE9E2ED16B7BFD2A32184CB22BEFA8, 0xF0A7890E11AEA1B6D25F60FCAA7095CB, N'User', 1, @NowUtc, NULL);

DECLARE @SellerId INT = (SELECT Id FROM [dbo].[Users] WHERE Username = N'swagger_seller');
DECLARE @Bidder1Id INT = (SELECT Id FROM [dbo].[Users] WHERE Username = N'swagger_bidder1');

-- 2. Phiên đang Active (để test POST /api/products/{id}/bids ngay lập tức)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Products] WHERE [Name] = N'iPhone 16 Pro Max 256GB Titan Sa Mạc (Đang đấu giá)')
BEGIN
    INSERT [dbo].[Products] ([Name], [Description], [StartingPrice], [CurrentPrice], [StartTime], [EndTime], [Status], [SellerId], [WinnerId], [ImageUrl], [Category], [CategoryId], [CreatedAt], [UpdatedAt], [CancellationReason])
    VALUES (
        N'iPhone 16 Pro Max 256GB Titan Sa Mạc (Đang đấu giá)',
        N'Phiên đấu giá mẫu đang Active trong 7 ngày để test đặt giá trên Swagger.',
        25000000.00, 25000000.00,
        DATEADD(MINUTE, -10, @NowUtc),
        DATEADD(DAY, 7, @NowUtc),
        0, -- Active
        @SellerId, NULL,
        N'https://images.unsplash.com/photo-1695048133142-1a20484d2569',
        N'Đồ điện tử & Công nghệ', 1,
        @NowUtc, @NowUtc, NULL
    );
    DECLARE @ActiveProductId INT = SCOPE_IDENTITY();
    INSERT [dbo].[ProductImages] ([FileName], [ContentType], [Length], [UploadedAt], [ProductId], [CloudinaryPublicId], [CloudinaryUrl])
    VALUES (N'iphone-16-pro-max.jpg', N'image/jpeg', 0, @NowUtc, @ActiveProductId, N'demo/iphone-16-pro-max', N'https://images.unsplash.com/photo-1695048133142-1a20484d2569');
END

-- 3. Phiên đang Scheduled (để test PUT /api/products/{id} sửa trước giờ mở hoặc Admin hủy)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Products] WHERE [Name] = N'Rolex Datejust 41 Vintage (Sắp mở bán)')
BEGIN
    INSERT [dbo].[Products] ([Name], [Description], [StartingPrice], [CurrentPrice], [StartTime], [EndTime], [Status], [SellerId], [WinnerId], [ImageUrl], [Category], [CategoryId], [CreatedAt], [UpdatedAt], [CancellationReason])
    VALUES (
        N'Rolex Datejust 41 Vintage (Sắp mở bán)',
        N'Phiên đấu giá mẫu trạng thái Scheduled (mở sau 2 ngày) để test sửa sản phẩm hoặc hủy phiên.',
        80000000.00, 80000000.00,
        DATEADD(DAY, 2, @NowUtc),
        DATEADD(DAY, 7, @NowUtc),
        3, -- Scheduled
        @SellerId, NULL,
        N'https://images.unsplash.com/photo-1523170335258-f5ed11844a49',
        N'Đồng hồ & Trang sức', 2,
        @NowUtc, @NowUtc, NULL
    );
END

-- 4. Phiên đã Completed + Đơn hàng Pending + Thông báo mẫu (để test /api/orders và /api/notifications)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Products] WHERE [Name] = N'Sony A7 IV Full-Frame (Đã chốt đơn demo)')
BEGIN
    INSERT [dbo].[Products] ([Name], [Description], [StartingPrice], [CurrentPrice], [StartTime], [EndTime], [Status], [SellerId], [WinnerId], [ImageUrl], [Category], [CategoryId], [CreatedAt], [UpdatedAt], [CancellationReason])
    VALUES (
        N'Sony A7 IV Full-Frame (Đã chốt đơn demo)',
        N'Phiên đấu giá đã kết thúc có người thắng để test luồng Order và Notification trên Swagger.',
        40000000.00, 42000000.00,
        DATEADD(DAY, -2, @NowUtc),
        DATEADD(HOUR, -1, @NowUtc),
        1, -- Completed
        @SellerId, @Bidder1Id,
        N'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
        N'Đồ điện tử & Công nghệ', 1,
        DATEADD(DAY, -3, @NowUtc), DATEADD(HOUR, -1, @NowUtc), NULL
    );
    DECLARE @DoneProductId INT = SCOPE_IDENTITY();
    INSERT [dbo].[Bids] ([ProductId], [UserId], [Amount], [BidTime])
    VALUES (@DoneProductId, @Bidder1Id, 42000000.00, DATEADD(HOUR, -2, @NowUtc));

    INSERT [dbo].[Orders] ([ProductId], [BuyerId], [SellerId], [FinalPrice], [ShippingAddress], [Status], [CreatedAt], [CompletedAt])
    VALUES (@DoneProductId, @Bidder1Id, @SellerId, 42000000.00, NULL, 0, DATEADD(HOUR, -1, @NowUtc), NULL);

    INSERT [dbo].[Notifications] ([UserId], [Title], [Message], [IsRead], [CreatedAt])
    VALUES
        (@Bidder1Id, N'Chúc mừng bạn đã thắng đấu giá!', N'Bạn đã chiến thắng phiên đấu giá sản phẩm ''Sony A7 IV Full-Frame (Đã chốt đơn demo)'' với mức giá 42,000,000 VNĐ. Vui lòng cập nhật địa chỉ nhận hàng.', 0, DATEADD(HOUR, -1, @NowUtc)),
        (@SellerId, N'Phiên đấu giá thành công', N'Sản phẩm ''Sony A7 IV Full-Frame (Đã chốt đơn demo)'' của bạn đã kết thúc thành công với giá 42,000,000 VNĐ. Đơn hàng mới đã được khởi tạo.', 0, DATEADD(HOUR, -1, @NowUtc));
END
GO