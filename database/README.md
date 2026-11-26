# BidNet – Xóa và tạo lại dữ liệu SQL

Thư mục này chứa bộ script làm sạch database `BidNetDb` và nạp dữ liệu mẫu
cho đồ án **Lập trình Web 2**. Script chỉ thao tác dữ liệu (DML), không sửa
schema hay migration.

## 1. Các file

| File | Tác dụng |
| --- | --- |
| `reset-all-data.sql` | Xóa toàn bộ 7 bảng và đưa identity của từng bảng về 1. |
| `reset-products-only.sql` | Chỉ xóa `Orders`, `Bids`, `ProductImages`, `Products`. Giữ `Users` và `Categories`. |
| `seed-clean.sql` | Script độc lập: tự xóa toàn bộ dữ liệu rồi nạp 5 users, 6 danh mục, 16 sản phẩm, 28 lượt đặt giá, 3 đơn hàng, 9 thông báo. |

> `seed-clean.sql` chạy được một mình vì đầu script đã có bước xóa.
> Chạy `reset-all-data.sql` trước chỉ để chắc chắn database trống hoàn toàn.

## 2. Điều kiện

- SQL Server Express đang chạy, instance `.\SQLEXPRESS`.
- Database `BidNetDb` đã được tạo bằng migration của backend.
- `sqlcmd` có trong `PATH`. Nếu không, dùng đường dẫn đầy đủ:

```powershell
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" `
  -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\seed-clean.sql
```

> `-f 65001` bắt buộc để tiếng Việt trong file UTF-8 không bị lỗi.
> `-E` dùng Windows Authentication, `-C` tin cậy chứng chỉ local.

**Cảnh báo:** các script xóa dữ liệu vĩnh viễn. Hãy sao lưu nếu cần giữ dữ liệu
đang có:

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -Q "BACKUP DATABASE BidNetDb TO DISK = N'D:\backup\BidNetDb.bak' WITH INIT"
```

## 3. Quy trình khuyến nghị – làm sạch toàn bộ

Chạy từ thư mục gốc `D:\all_my_project\BidNet`:

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\reset-all-data.sql
sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\seed-clean.sql
```

Hoặc chỉ cần một lệnh, vì `seed-clean.sql` đã tự xóa:

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\seed-clean.sql
```

## 4. Quy trình chỉ làm sạch sản phẩm

Dùng khi muốn giữ tài khoản và danh mục, chỉ xóa các phiên đấu giá cũ:

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -f 65001 -i database\reset-products-only.sql
```

Sau đó đăng nhập bằng tài khoản có sẵn và tạo sản phẩm mới qua giao diện.
**Không** chạy `seed-clean.sql` ngay sau bước này nếu muốn giữ users, vì
`seed-clean.sql` sẽ xóa cả users và categories.

## 5. Kiểm tra sau khi chạy

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -d BidNetDb -W -Q @"
SET NOCOUNT ON;
SELECT 'Users' AS Bang, COUNT(*) AS SoDong FROM dbo.Users
UNION ALL SELECT 'Categories', COUNT(*) FROM dbo.Categories
UNION ALL SELECT 'Products', COUNT(*) FROM dbo.Products
UNION ALL SELECT 'Bids', COUNT(*) FROM dbo.Bids
UNION ALL SELECT 'Orders', COUNT(*) FROM dbo.Orders
UNION ALL SELECT 'Notifications', COUNT(*) FROM dbo.Notifications
UNION ALL SELECT 'ProductImages', COUNT(*) FROM dbo.ProductImages;
"@
```

Kết quả mong đợi sau `seed-clean.sql`:

| Bảng | Số dòng |
| --- | ---: |
| Users | 5 |
| Categories | 6 |
| Products | 16 |
| Bids | 28 |
| Orders | 3 |
| Notifications | 9 |
| ProductImages | 0 |

Kiểm tra API (backend đang chạy ở cổng 5014):

```powershell
(Invoke-WebRequest "http://localhost:5014/api/products?status=Active&sort=ending_soon&pageSize=20" -UseBasicParsing).StatusCode
(Invoke-WebRequest "http://localhost:5014/api/Categories" -UseBasicParsing).StatusCode
```

## 6. Tài khoản demo

Mật khẩu được băm bằng PBKDF2-SHA256, 210.000 vòng, salt 16 byte – đúng tham số
`AuthService` đang dùng. Không có mật khẩu dạng văn bản trong database.

| Username | Mật khẩu | Vai trò | Dùng để |
| --- | --- | --- | --- |
| `admin` | `Admin@12345` | Admin | Quản trị danh mục, hủy phiên, xem toàn bộ đơn |
| `seller_demo` | `Demo@12345` | User | Đăng bán, xem đơn bán |
| `bidder_demo` | `Demo@12345` | User | Đặt giá, xem đơn mua |
| `bidder_demo2` | `Demo@12345` | User | Đặt giá, tạo cạnh tranh giữa hai người mua |
| `seller_art` | `Demo@12345` | User | Đăng bán nhóm đồng hồ, nghệ thuật, thể thao |

Đăng nhập bằng username **hoặc** email, ví dụ `admin@bidnet.vn`.

## 7. Điểm cần biết về dữ liệu mẫu

- **Thời gian tương đối:** script dùng `SYSUTCDATETIME()` và `DATEADD`, nên
  phiên đang diễn ra luôn còn hạn, phiên sắp diễn ra luôn ở tương lai.
- **Worker 5 giây:** `AuctionClosingService` chỉ đóng phiên `Active` đã qua
  `EndTime` và mở phiên `Scheduled` đã tới `StartTime`. Dữ liệu seed được đặt
  ngoài các ngưỡng này nên không bị đổi trạng thái ngay sau khi nạp.
- **Giá:** `CurrentPrice` luôn bằng lượt đặt giá cao nhất. Phiên không có lượt
  giá giữ `CurrentPrice = StartingPrice`.
- **Đơn hàng:** chỉ 3 phiên `Completed` có người thắng mới sinh đơn. Mỗi sản
  phẩm tối đa một đơn theo unique index `IX_Orders_ProductId`.
- **Ảnh:** `ProductImages` để trống vì bảng này lưu metadata Cloudinary do API
  upload tạo ra. `Products.ImageUrl` trỏ tới ảnh SVG tĩnh trong
  `frontend/public/images/` để giao diện có hình khi chạy demo.
- **RowVersion:** không insert cột `timestamp`; SQL Server tự sinh khi ghi.

## 8. Lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `Cannot open database "BidNetDb"` | Chạy backend một lần để migration tạo database, hoặc kiểm tra tên instance. |
| Tiếng Việt thành `?` | Thiếu `-f 65001`, hoặc file bị lưu sai bảng mã. |
| `The DELETE statement conflicted with the REFERENCE constraint` | Chạy đúng thứ tự trong `reset-all-data.sql`; không xóa `Products` trước `Orders`/`Bids`. |
| `IDENTITY_INSERT is already ON` | Một script trước bị dừng giữa chừng. Chạy lại `reset-all-data.sql` hoặc `seed-clean.sql` để transaction tự dọn. |
| Đăng nhập demo sai mật khẩu | Chạy lại `seed-clean.sql`; kiểm tra đã dùng đúng username `admin`, không phải email cũ. |
# Cập nhật kiểm soát đồng thời đơn hàng

Sau khi lấy phiên bản có migration `OrderConcurrency`, chạy `dotnet ef database update`
trong môi trường đã cấu hình connection string. Migration thêm cột `Orders.RowVersion`;
các script reset/seed vẫn giữ schema và không cần đưa RowVersion vào INSERT.

Ảnh model và thông số đã đối chiếu có thể cập nhật riêng bằng `update-verified-media.sql`;
script này không xóa tài khoản, lượt giá hoặc đơn hàng.
