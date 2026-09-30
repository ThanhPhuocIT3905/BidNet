# Đặc tả triển khai Back-end BidNet

**Đề tài:** Sàn đấu giá sản phẩm trực tuyến  
**Phiên bản tài liệu:** 1.0  
**Ngày:** 24/09/2026  
**Trạng thái:** Phạm vi phiên bản 1 đã được triển khai trong dự án; mục 10 vẫn là danh sách nghiệm thu cần duy trì.

## 1. Mục tiêu và phạm vi

BidNet cung cấp REST API cho người dùng đăng sản phẩm, tham gia đấu giá, theo dõi kết quả và cho quản trị viên quản lý tài khoản, phiên đấu giá. Một phiên đấu giá chỉ có một sản phẩm, một người bán và tối đa một người thắng.

### 1.1 Phạm vi phiên bản 1

- Đăng ký, đăng nhập, xem và sửa hồ sơ cá nhân.
- Xem, tìm kiếm, lọc và phân trang sản phẩm đấu giá.
- Người bán tạo và sửa sản phẩm trước khi phiên bắt đầu.
- Người mua đặt giá; lưu lịch sử các lượt đặt giá hợp lệ.
- Tự động mở và đóng phiên theo thời gian; xác định người thắng.
- Cập nhật giá và kết quả phiên qua SignalR.
- Quản trị viên xem tài khoản, khóa/mở tài khoản, hủy phiên vi phạm.
- Cung cấp tài liệu OpenAPI, xử lý lỗi thống nhất và kiểm thử các quy tắc chính.

### 1.2 Ngoài phạm vi phiên bản 1

- Thanh toán thật, ví điện tử, nạp/rút tiền, đặt cọc, hoàn tiền và giao hàng.
- Đấu giá tự động theo mức giá tối đa, mua ngay, trả giá kín, đấu giá nhiều đơn vị.
- Đăng nhập bằng bên thứ ba, chat, đánh giá người bán, kiểm duyệt ảnh tự động.

`User.Balance` hiện có trong model không được dùng để trừ hoặc giữ tiền trong phiên bản 1. Không hiển thị nó như số dư có thể giao dịch khi chưa có sổ giao dịch và quy trình thanh toán.

## 2. Vai trò và quyền

| Hành động | Khách | User | Admin |
|---|:---:|:---:|:---:|
| Xem danh sách, chi tiết, lịch sử giá công khai | Có | Có | Có |
| Đăng ký, đăng nhập | Có | Có | Có |
| Xem/sửa hồ sơ của chính mình | Không | Có | Có |
| Đăng sản phẩm | Không | Có | Có |
| Sửa sản phẩm của chính mình trước giờ mở | Không | Có | Có |
| Đặt giá sản phẩm của người khác | Không | Có | Có |
| Xem lịch sử đặt giá cá nhân | Không | Có | Có |
| Khóa/mở tài khoản khác | Không | Không | Có |
| Hủy phiên vi phạm | Không | Không | Có |

Quyền `Admin` không miễn các quy tắc đặt giá. Tài khoản bị khóa (`IsActive = false`) không được đăng nhập mới, đăng sản phẩm hoặc đặt giá. API phải kiểm tra trạng thái tài khoản tại thời điểm thực hiện hành động nhạy cảm, không chỉ dựa vào claim cũ trong token.

## 3. Quy tắc nghiệp vụ bắt buộc

### 3.1 Sản phẩm và phiên đấu giá

**BR-01.** Người bán phải đăng nhập và tài khoản đang hoạt động. `SellerId` lấy từ danh tính đã xác thực; client không được gửi hoặc sửa trường này.

**BR-02.** Tên sản phẩm bắt buộc, tối đa 200 ký tự; mô tả tối đa 2.000 ký tự; giá khởi điểm tối thiểu 1.000 VND. Giá là số nguyên VND và được lưu bằng kiểu `decimal`, không dùng `float`/`double`.

**BR-03.** Thời gian tạo phiên phải thỏa `StartTime > thời điểm tạo` và `EndTime > StartTime`. API nhận và trả thời gian theo UTC, định dạng ISO 8601. Thời gian chuẩn để kiểm tra đặt giá là thời gian của server.

**BR-04.** Phiên mới ở trạng thái `Scheduled`. Tác vụ nền chuyển sang `Active` khi đến `StartTime`. Trong mọi trường hợp, API đặt giá vẫn phải kiểm tra trực tiếp `StartTime` và `EndTime`; trạng thái cập nhật chậm không được mở cửa đặt giá sai thời điểm.

**BR-05.** Người bán chỉ được sửa tên, mô tả, ảnh, danh mục, giá khởi điểm và thời gian khi phiên còn `Scheduled` và chưa có lượt đặt giá. Không được đổi `SellerId`, `WinnerId` hoặc `CurrentPrice` qua API sửa sản phẩm.

**BR-06.** Không xóa vật lý sản phẩm đã có lượt đặt giá. Admin có thể chuyển phiên vi phạm sang `Cancelled` và ghi lý do hủy.

### 3.2 Đặt giá

**BR-07.** Chỉ tài khoản đang hoạt động, đã đăng nhập và không phải người bán của phiên được đặt giá.

**BR-08.** Chỉ nhận giá khi `Status = Active` và `StartTime <= nowUtc < EndTime`.

**BR-09.** Bước giá tối thiểu của phiên bản 1 là **1.000 VND**, đặt trong cấu hình ứng dụng để có thể đổi mà không sửa code. Lượt giá đầu tiên phải `Amount >= StartingPrice`. Các lượt tiếp theo phải `Amount >= CurrentPrice + 1.000`.

**BR-10.** Giá gửi lên phải là số nguyên VND dương; API không chấp nhận số thập phân, giá âm, giá bằng 0 hoặc giá vượt khả năng lưu trữ của cột SQL.

**BR-11.** Lượt giá hợp lệ được ghi vào `Bids` và `Products.CurrentPrice` được cập nhật cùng một đơn vị công việc. Nếu một thao tác thất bại, không được lưu một nửa kết quả.

**BR-12.** Hai yêu cầu đặt giá đồng thời trên cùng phiên phải được giải quyết theo thứ tự nhất quán. Chỉ yêu cầu còn thỏa mức giá tối thiểu dựa trên giá mới nhất được chấp nhận. Dùng `rowversion`/concurrency token của SQL Server trên `Product`, xử lý xung đột bằng đọc lại và trả `409 Conflict` nếu giá đã lỗi thời. Không phát sự kiện realtime trước khi lưu thành công.

**BR-13.** Không cho sửa hoặc xóa bản ghi `Bid` đã được chấp nhận qua API. Lịch sử giá được sắp theo `BidTime` giảm dần, thêm `Id` làm tiêu chí phụ để có thứ tự ổn định.

### 3.3 Kết thúc phiên

**BR-14.** Tác vụ nền tìm các phiên có `EndTime <= nowUtc` và chưa đóng; chuyển sang `Completed`.

**BR-15.** Nếu có lượt giá hợp lệ, người đặt giá cao nhất là người thắng và `WinnerId` được gán bằng `Bid.UserId`. Nếu không có lượt giá, `WinnerId = null`.

**BR-16.** Tác vụ đóng phiên phải an toàn khi chạy lại: mỗi phiên chỉ được ghi một kết quả cuối. Đóng phiên và đặt giá đồng thời phải dựa trên kiểm tra thời gian, trạng thái và concurrency token trong database.

**BR-17.** Phiên `Completed` hoặc `Cancelled` không nhận lượt giá mới. Kết quả phiên đã đóng chỉ có thể bị thay đổi qua quy trình quản trị riêng ở phiên bản sau.

### 3.4 Giá và trạng thái

`CurrentPrice` của phiên chưa có lượt giá bằng `StartingPrice`. Khi có giá hợp lệ, `CurrentPrice` bằng giá hợp lệ cao nhất. `WinnerId` chỉ có giá trị khi phiên `Completed` và có ít nhất một lượt giá.

```text
Scheduled ──đến StartTime──> Active ──đến EndTime──> Completed
    │                         │
    └────admin hủy────────────┴──────────────────────> Cancelled
```

## 4. Thiết kế dữ liệu

### 4.1 Bảng `Users`

| Cột | Kiểu/điều kiện | Ý nghĩa |
|---|---|---|
| `Id` | `int`, PK | Mã người dùng |
| `Username` | `nvarchar(50)`, required, unique | Tên đăng nhập |
| `Email` | `nvarchar(100)`, required, unique | Email |
| `PasswordHash`, `PasswordSalt` | binary, không trả trong API | Thông tin xác minh mật khẩu |
| `FullName` | `nvarchar(200)`, nullable | Họ tên |
| `PhoneNumber` | `nvarchar(20)`, nullable | Số điện thoại |
| `Role` | `User` hoặc `Admin` | Vai trò |
| `IsActive` | `bit`, mặc định true | Khả năng sử dụng tài khoản |
| `CreatedAt`, `UpdatedAt` | UTC | Thời gian tạo/cập nhật |

Mật khẩu phải được băm bằng cơ chế chuyên dụng, có salt; không lưu mật khẩu gốc hoặc tự ghép chuỗi rồi băm bằng SHA-256. Có thể dùng ASP.NET Core Identity hoặc `PasswordHasher<TUser>` nhất quán với model hiện có.

### 4.2 Bảng `Products`

| Cột | Kiểu/điều kiện | Ý nghĩa |
|---|---|---|
| `Id` | `int`, PK | Mã phiên/sản phẩm |
| `Name` | `nvarchar(200)`, required | Tên |
| `Description` | `nvarchar(2000)`, nullable | Mô tả |
| `StartingPrice`, `CurrentPrice` | `decimal(18,2)`, không âm | Giá bằng VND, API chỉ nhận số nguyên |
| `StartTime`, `EndTime` | UTC, required | Thời gian mở/đóng |
| `Status` | enum | `Scheduled`, `Active`, `Completed`, `Cancelled` |
| `SellerId` | FK `Users.Id`, required | Người bán |
| `WinnerId` | FK `Users.Id`, nullable | Người thắng |
| `ImageUrl`, `Category` | nullable | Ảnh và danh mục dạng chuỗi |
| `RowVersion` | `rowversion`, required | Phát hiện cập nhật đồng thời |
| `CancellationReason` | nullable | Lý do admin hủy phiên |
| `CreatedAt`, `UpdatedAt` | UTC | Thời gian tạo/cập nhật |

Giữ `Category` dạng chuỗi ở phiên bản 1 để phù hợp dự án hiện tại. Chỉ tách bảng `Categories` khi có yêu cầu quản lý danh mục bằng API riêng.

### 4.3 Bảng `Bids`

| Cột | Kiểu/điều kiện | Ý nghĩa |
|---|---|---|
| `Id` | `int`, PK | Mã lượt giá |
| `ProductId` | FK `Products.Id`, required | Phiên đấu giá |
| `UserId` | FK `Users.Id`, required | Người đặt giá |
| `Amount` | `decimal(18,2)`, dương | Giá đã chấp nhận |
| `BidTime` | UTC, required | Thời điểm server ghi nhận |

Chỉ số cần có: unique index `Users.Username`, `Users.Email`; index `Products.Status, StartTime, EndTime`; index `Bids.ProductId, BidTime` để đọc lịch sử. Quan hệ người bán, người thắng và người đặt giá với `Users` phải tránh đường cascade delete vòng; không xóa cứng tài khoản đã tham gia phiên.

**Migration:** thay đổi model phải đi kèm migration mới. Không sửa `InitialCreate` nếu nó đã được áp dụng vào database. Kiểm tra migration trên môi trường phát triển trước khi áp dụng lên database chứa dữ liệu.

## 5. Hợp đồng API phiên bản 1

Prefix API: `/api`. Request và response dùng JSON. Endpoint có phân trang nhận `page` từ 1, `pageSize` mặc định 20, tối đa 100. Response danh sách chứa `items`, `page`, `pageSize`, `totalCount`.

| Method | Route | Quyền | Request chính | Response thành công |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | `username`, `email`, `password`, `fullName?` | `201`, thông tin tài khoản không có hash |
| `POST` | `/api/auth/login` | Public | `usernameOrEmail`, `password` | `200`, access token và thông tin tài khoản |
| `GET` | `/api/users/me` | User/Admin | — | `200`, hồ sơ cá nhân |
| `PUT` | `/api/users/me` | User/Admin | `fullName?`, `phoneNumber?` | `200`, hồ sơ mới |
| `GET` | `/api/products` | Public | `q?`, `category?`, `status?`, `minPrice?`, `maxPrice?`, `page?`, `pageSize?` | `200`, danh sách phân trang |
| `GET` | `/api/products/{id}` | Public | — | `200`, chi tiết phiên |
| `POST` | `/api/products` | User/Admin | `name`, `description?`, `startingPrice`, `startTime`, `endTime`, `imageUrl?`, `category?` | `201`, sản phẩm mới |
| `PUT` | `/api/products/{id}` | Chủ sản phẩm | Các trường được phép sửa theo BR-05 | `200`, sản phẩm mới |
| `GET` | `/api/products/me` | User/Admin | `page?`, `pageSize?` | `200`, sản phẩm đã đăng |
| `POST` | `/api/products/{id}/bids` | User/Admin | `amount` | `201`, lượt giá đã lưu và giá hiện tại |
| `GET` | `/api/products/{id}/bids` | Public | `page?`, `pageSize?` | `200`, lịch sử giá công khai |
| `GET` | `/api/users/me/bids` | User/Admin | `page?`, `pageSize?` | `200`, lịch sử đặt giá cá nhân |
| `GET` | `/api/admin/users` | Admin | `page?`, `pageSize?` | `200`, danh sách tài khoản |
| `PATCH` | `/api/admin/users/{id}/status` | Admin | `isActive` | `200`, trạng thái mới |
| `PATCH` | `/api/admin/products/{id}/cancel` | Admin | `reason` | `200`, phiên đã hủy |

Các trường `SellerId`, `UserId`, `Status`, `CurrentPrice`, `WinnerId`, `BidTime` do server quyết định. Không nhận các trường này từ request tạo/sửa sản phẩm hoặc đặt giá.

### 5.1 Mã phản hồi lỗi

| Mã | Trường hợp |
|---|---|
| `400 Bad Request` | Dữ liệu thiếu/sai định dạng, thời gian hoặc giá không hợp lệ |
| `401 Unauthorized` | Chưa đăng nhập/token không hợp lệ |
| `403 Forbidden` | Không phải chủ sở hữu, không phải Admin, tài khoản bị khóa |
| `404 Not Found` | Không tìm thấy tài nguyên |
| `409 Conflict` | Username/email trùng; giá đã lỗi thời; phiên vừa đóng hoặc đổi trạng thái |
| `500 Internal Server Error` | Lỗi bất ngờ; ghi log chi tiết trên server, không trả stack trace cho client |

Lỗi trả cùng một định dạng (`ProblemDetails` hoặc một DTO lỗi thống nhất) với mã lỗi nghiệp vụ ổn định để client hiển thị thông báo phù hợp.

## 6. Xác thực và bảo mật

- API đăng ký tự gán `Role = User`; client không được chọn `Admin`.
- Login xác minh hash mật khẩu và trạng thái tài khoản trước khi cấp token.
- Token chứa định danh user và vai trò; khóa ký, thời hạn token và thông tin kết nối nhạy cảm được đặt qua user secrets hoặc biến môi trường khi triển khai, không commit bí mật vào Git.
- Cấu hình authentication và authorization trong `Program.cs`; áp dụng `[Authorize]` và chính sách vai trò cho từng endpoint. Kiểm tra quyền sở hữu sản phẩm trong service.
- Chỉ dùng HTTPS ngoài môi trường local; giới hạn kích thước request, phân trang, xác thực URL ảnh nếu nhận từ người dùng.
- Không ghi mật khẩu, token hay connection string vào log. Rate limit tối thiểu cho login và đặt giá để giảm thử mật khẩu và spam.
- Hub realtime phải xác thực người dùng khi tham gia nhóm riêng; nhóm SignalR không thay thế việc kiểm tra quyền.

## 7. Cập nhật realtime và tác vụ nền

`AuctionHub` dùng nhóm theo `ProductId`. Client theo dõi phiên nhận các sự kiện `BidAccepted` (giá mới, người đặt giá được ẩn danh theo chính sách hiển thị, thời gian) và `AuctionClosed` (trạng thái, kết quả). Server chỉ phát sau khi giao dịch database hoàn tất. Nếu client mất kết nối, dữ liệu REST/database là nguồn sự thật; kết nối lại phải tải lại chi tiết phiên.

Tác vụ nền chạy định kỳ để chuyển `Scheduled` sang `Active` và `Active` sang `Completed`. Mỗi lần xử lý phải an toàn khi chạy lại, có logging và giới hạn số phiên mỗi lượt. Nếu triển khai nhiều instance, cần cơ chế phối hợp ở database để một phiên không bị đóng hai lần.

## 8. Cấu trúc triển khai trong dự án

| Vị trí | Trách nhiệm |
|---|---|
| `Controllers/` | Nhận request, ràng buộc DTO, trả HTTP status; không chứa toàn bộ nghiệp vụ |
| `Services/` | `AuthService`, `ProductService`, `BidService`, `AuctionClosingService`; thực thi quy tắc |
| `Repositories/` | Truy vấn dữ liệu phức tạp nếu cần; tránh lặp `SaveChanges` rải rác ở nhiều lớp |
| `Data/` | `AppDbContext`, cấu hình quan hệ/index/concurrency, migrations |
| `Models/` | Entity được lưu vào SQL Server |
| `DTOs/` | Hợp đồng request/response, không làm lộ trường nhạy cảm |
| `Hubs/` | Gửi sự kiện realtime; không quyết định giá thắng |
| `Middleware/` | Xử lý lỗi, logging/correlation nếu cần |

Hiện tại `ProductController` dùng `AppDbContext` trực tiếp trong khi dự án cũng có repository. Khi triển khai, đưa quy tắc đặt giá vào một service duy nhất và thống nhất nơi gọi `SaveChanges`, đặc biệt cho thao tác ghi `Bid` và cập nhật `Product`.

## 9. Trình tự thực hiện

| Giai đoạn | Công việc | Điều kiện hoàn thành |
|---|---|---|
| 1. Dữ liệu và trạng thái | Bổ sung trạng thái, `RowVersion`, ràng buộc, migration | Migration áp dụng được; các quan hệ/index đúng |
| 2. Tài khoản | Register, login, hash mật khẩu, xác thực, phân quyền | API ghi lấy đúng user từ token; tài khoản bị khóa bị từ chối |
| 3. Sản phẩm | Tạo, sửa, danh sách, tìm kiếm, phân trang | Chỉ chủ sản phẩm sửa được trước giờ mở |
| 4. Đấu giá | Đặt giá, lịch sử, kiểm tra đồng thời | Giá tăng đúng; không nhận giá sai hoặc ghi đè khi đua lệnh |
| 5. Vòng đời | Tác vụ mở/đóng phiên, chọn người thắng | Không cần request từ client để đóng; chạy lại không tạo kết quả khác |
| 6. Realtime | Hub, nhóm theo phiên, sự kiện sau commit | Client thấy giá mới và đồng bộ lại được sau reconnect |
| 7. Quản trị và chất lượng | Khóa tài khoản, hủy phiên, log, tài liệu API, kiểm thử | Quyền được kiểm tra ở server; các ca kiểm thử bắt buộc đạt |

## 10. Kiểm thử và tiêu chí nghiệm thu

### 10.1 Ca kiểm thử bắt buộc

1. Đăng ký trùng username/email bị từ chối; mật khẩu không xuất hiện trong response/database dưới dạng rõ.
2. API yêu cầu đăng nhập trả `401` khi không có token; tài khoản thường gọi API Admin trả `403`.
3. Người dùng A không sửa được sản phẩm của người dùng B.
4. Sản phẩm có thời gian không hợp lệ hoặc giá khởi điểm dưới mức tối thiểu bị từ chối.
5. Người bán tự đặt giá bị từ chối; tài khoản bị khóa đặt giá bị từ chối.
6. Trước giờ mở và từ đúng thời điểm kết thúc trở đi đều không nhận giá.
7. Giá đầu tiên dưới `StartingPrice`, giá tiếp theo dưới bước giá và giá không nguyên VND bị từ chối.
8. Hai yêu cầu đặt giá đồng thời không thể tạo `CurrentPrice` thấp hơn lượt giá đã lưu hoặc chấp nhận hai giá dựa trên cùng giá cũ.
9. Phiên kết thúc có giá xác định đúng người thắng; phiên không có giá có `WinnerId = null`.
10. Tác vụ đóng phiên chạy lại không làm đổi kết quả; không còn nhận giá sau khi hoàn tất hoặc hủy.
11. Danh sách có phân trang ổn định; không endpoint nào trả `PasswordHash`/`PasswordSalt`.
12. SignalR chỉ phát giá sau khi lưu thành công; client tải lại REST thấy cùng kết quả.

### 10.2 Hoàn thành phiên bản 1 khi

- Toàn bộ API trong mục 5 có hợp đồng và mã lỗi nhất quán.
- Migration mới áp dụng được lên database phát triển; build và bộ kiểm thử cốt lõi chạy thành công.
- Không còn ID người bán/người đặt giá gán cố định trong code.
- Có thể đi trọn luồng: đăng ký → đăng nhập → đăng sản phẩm → đến giờ mở → đặt giá → đến giờ đóng → xem người thắng, không cần chỉnh dữ liệu bằng tay.

## 11. Đối chiếu với mã nguồn hiện tại

| Hạng mục | Trạng thái triển khai |
|---|---|
| EF Core + SQL Server | Có migration `InitialCreate` và `AuctionWorkflow`; migration mới đã áp dụng trên `BidNetDb` local |
| User/Product/Bid | Có entity, quan hệ, chỉ số, `Product.RowVersion` |
| Sản phẩm | Có tạo/sửa theo quyền, xem chi tiết, tìm kiếm, lọc và phân trang |
| Đặt giá | Có `BidService`, bước giá, kiểm tra thời gian/quyền và xử lý xung đột `RowVersion` |
| Xác thực | Có register/login, PBKDF2, JWT và kiểm tra tài khoản đang hoạt động |
| SignalR | Có Hub theo nhóm phiên và sự kiện sau khi lưu database |
| Quản trị | Có danh sách/khóa tài khoản và hủy phiên |
| Đóng phiên | Có tác vụ nền tự mở/đóng và chọn người thắng |
| Kiểm thử | Có test tự động cho quy tắc chính; cần bổ sung kiểm thử tranh chấp giá trên SQL Server trước khi triển khai nhiều instance |

Tài liệu này là phạm vi triển khai phiên bản 1. Mọi chức năng ở mục 1.2 cần được đặc tả riêng trước khi bổ sung vào code hoặc database.
