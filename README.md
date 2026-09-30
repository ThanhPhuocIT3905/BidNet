# BidNet Back-end

Back-end sàn đấu giá dùng ASP.NET Core 10, EF Core 10 và SQL Server. [Đặc tả triển khai](docs/BidNet-Backend-Specification.md) mô tả nghiệp vụ và API.

## Chạy trên một máy mới

Máy cần có **.NET SDK 10** và một **SQL Server có thể kết nối**. SQL Server có thể chạy trên máy của thành viên, trên máy chung của nhóm hoặc trong môi trường do nhóm cung cấp. Tài khoản kết nối cần quyền tạo/cập nhật database khi chạy migration.

Sau khi clone repository, mở terminal tại thư mục chứa `BidNet.csproj`:

```powershell
dotnet tool restore
dotnet restore BidNet.csproj
```

Mỗi máy tự đặt chuỗi kết nối. Nếu máy Windows có SQL Server mặc định ở `localhost` và dùng Windows Authentication:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=BidNetDb;Trusted_Connection=True;TrustServerCertificate=True;" --project BidNet.csproj
```

Nếu dùng SQL Server Express, đổi `Server=localhost` thành tên instance của máy (thường là `Server=.\SQLEXPRESS`). Nếu dùng máy chủ chung hoặc SQL Authentication, thay toàn bộ chuỗi kết nối bằng thông tin do nhóm cấp. Kiểm tra tên server và kiểu xác thực bằng SSMS trước khi chạy migration.

Mỗi máy cũng cần một khóa JWT phát triển:

```powershell
$bidNetJwtKey = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
dotnet user-secrets set "Jwt:Key" $bidNetJwtKey --project BidNet.csproj
```

Sau đó tạo/cập nhật database từ **các migration đã có trong Git** và chạy ứng dụng:

```powershell
dotnet ef database update --project BidNet.csproj
dotnet run --project BidNet.csproj --launch-profile https
```

Mở `https://localhost:7010/swagger` để xem và thử API bằng Swagger UI. Có thể dùng `https://localhost:7010/scalar` hoặc tải `https://localhost:7010/openapi/v1.json`. Các trang tài liệu chỉ bật trong môi trường Development. Nếu chứng chỉ HTTPS phát triển chưa được tin cậy, chạy `dotnet dev-certs https --trust`. Cổng có thể khác nếu thành viên đổi `Properties/launchSettings.json`.

**Không chạy `dotnet ef migrations add InitialCreate` trên máy mới.** Hai migration hiện có được tải từ Git; `database update` sẽ áp dụng những migration còn thiếu. Mỗi máy dùng SQL Server riêng sẽ có database riêng. Muốn cùng xem một bộ dữ liệu, cả nhóm phải kết nối tới cùng một SQL Server/database với quyền phù hợp.

## Cấu hình và bảo mật

- `appsettings.json` chỉ chứa cấu hình chung. Chuỗi kết nối và `Jwt:Key` nằm trong .NET User Secrets của **từng máy** hoặc trong biến môi trường của nơi triển khai (`ConnectionStrings__DefaultConnection`, `Jwt__Key`).
- `UserSecretsId` trong `BidNet.csproj` là mã nhận diện cấu hình local, không phải giá trị bí mật; secrets không được đẩy lên Git.
- Khi nhiều bản chạy của cùng một hệ thống cần xác thực token của nhau, chúng phải dùng cùng issuer, audience và khóa ký JWT.
- API đăng ký luôn tạo vai trò `User`. Tạo Admin đầu tiên bằng thao tác quản trị trên SQL Server sau khi đã xác minh tài khoản.

Token từ `POST /api/auth/login` được gửi bằng header `Authorization: Bearer <token>` cho API cần đăng nhập.
Trong Swagger UI, gọi `POST /api/auth/login`, sao chép `accessToken`, bấm **Authorize** và dán token (không cần tự gõ `Bearer`). Sau đó có thể dùng **Try it out** với các API có biểu tượng khóa.

## Kiểm thử

```powershell
dotnet test Tests/BidNet.Tests.csproj
```

Các test nghiệp vụ thường dùng database InMemory độc lập. Test `StaleBid` kiểm tra `RowVersion` với SQL Server thật và chỉ chạy khi được bật rõ ràng:

```powershell
$env:BIDNET_TEST_SQL = "1"
$env:BIDNET_TEST_SQL_CONNECTION = "Server=localhost;Database=master;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet test Tests/BidNet.Tests.csproj --filter StaleBid
```

Đổi `BIDNET_TEST_SQL_CONNECTION` theo SQL Server của máy. Test tạo database `BidNet_Test_<guid>` và xóa đúng database tạm đó sau khi chạy; tài khoản SQL cần quyền tạo/xóa database.

## Realtime

Hub tại `/hubs/auction` yêu cầu đăng nhập. Client gọi `JoinProduct(productId)` để theo dõi, `LeaveProduct(productId)` để rời phiên. Hub phát `BidAccepted` và `AuctionClosed`. Khi kết nối lại, client tải `GET /api/products/{id}` vì database là nguồn dữ liệu cuối cùng.

## Những file cần đưa lên Git

Đẩy mã nguồn, `Data/Migrations`, `Tests`, `docs`, `.config/dotnet-tools.json`, `.gitignore` và các tệp cấu hình không chứa bí mật. Không đẩy `bin/`, `obj/`, `.vs/`, `*.user` hoặc User Secrets. Dự án đã từng theo dõi file build; thay đổi Git sẽ bỏ theo dõi chúng mà vẫn giữ file trên máy hiện tại.
