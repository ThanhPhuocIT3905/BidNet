
# demo-data.ps1 — Tạo dữ liệu demo
# Chạy:  powershell -ExecutionPolicy Bypass -File docs/presentation/demo-data.ps1
# Điều kiện: Server đang chạy ở http://localhost:5014 hoặc cổng được chỉ định
# Kịch bản: Đăng ký/đăng nhập -> Quản trị danh mục -> Tạo phiên đấu giá
#           -> Đặt giá hợp lệ & các ca bắt lỗi (400, 403, 409)
#           -> Kết thúc phiên chốt Đơn hàng & Thông báo
param(
    [string]$BaseUrl = "http://localhost:5014"
)

$ErrorActionPreference = "Continue"
$base = $BaseUrl.TrimEnd('/')
$pass = "Demo@12345"
$adminPass = "Admin@12345"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " BIDNET DEMO AUTOMATION - CHUẨN BỊ DỮ LIỆU BẢO VỆ ĐỒ ÁN     " -ForegroundColor Cyan
Write-Host " Target API: $base" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

function Api($method, $url, $body, $token) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{
        Uri = "$base$url"
        Method = $method
        Headers = $headers
        ContentType = "application/json; charset=utf-8"
    }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 6) }
    try {
        return Invoke-RestMethod @params
    } catch {
        if ($_.ErrorDetails.Message) {
            try { return ($_.ErrorDetails.Message | ConvertFrom-Json) } catch { return $_.ErrorDetails.Message }
        }
        return @{ status = $_.Exception.Response.StatusCode.value__; message = $_.Exception.Message }
    }
}

Write-Host "`n== 1. Đăng ký các tài khoản demo (Nếu tồn tại server sẽ trả 409) ==" -ForegroundColor Yellow
foreach ($u in @("seller_demo", "bidder_demo", "bidder_demo2")) {
    Api "POST" "/api/auth/register" @{ username = $u; email = "$u@bidnet.local"; password = $pass; fullName = "Demo $u" } | Out-Null
}
Api "POST" "/api/auth/register" @{ username = "admin"; email = "admin@bidnet.vn"; password = $adminPass; fullName = "System Administrator" } | Out-Null

Write-Host "== 2. Đăng nhập lấy JWT Tokens ==" -ForegroundColor Yellow
$adminToken  = (Api "POST" "/api/auth/login" @{ usernameOrEmail = "admin"; password = $adminPass }).accessToken
$sellerToken = (Api "POST" "/api/auth/login" @{ usernameOrEmail = "seller_demo"; password = $pass }).accessToken
$bidderToken = (Api "POST" "/api/auth/login" @{ usernameOrEmail = "bidder_demo"; password = $pass }).accessToken
$bidder2Token = (Api "POST" "/api/auth/login" @{ usernameOrEmail = "bidder_demo2"; password = $pass }).accessToken

Write-Host "   -> Admin Token:  $($adminToken.Substring(0,30))..." -ForegroundColor Green
Write-Host "   -> Seller Token: $($sellerToken.Substring(0,30))..." -ForegroundColor Green
Write-Host "   -> Bidder Token: $($bidderToken.Substring(0,30))..." -ForegroundColor Green

Write-Host "`n== 3. Kiểm tra Danh mục (Categories) ==" -ForegroundColor Yellow
$cats = Api "GET" "/api/categories" $null $null
Write-Host "   Hiện có $($cats.Count) danh mục trong hệ thống." -ForegroundColor Cyan

Write-Host "`n== 4. Test Phân quyền (RBAC): User gọi API Admin ==" -ForegroundColor Yellow
Write-Host "   - User thường gọi POST /api/categories (Kỳ vọng 403 Forbidden):"
$forbidRes = Api "POST" "/api/categories" @{ name = "Danh muc lau"; description = "Test 403" } $bidderToken
Write-Host "     Server Response: $(ConvertTo-Json $forbidRes -Compress)" -ForegroundColor Magenta

Write-Host "`n== 5. Seller tạo phiên đấu giá (Bắt đầu sau 10 giây, kết thúc sau 35 giây) ==" -ForegroundColor Yellow
$start = (Get-Date).ToUniversalTime().AddSeconds(10).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end   = (Get-Date).ToUniversalTime().AddSeconds(35).ToString("yyyy-MM-ddTHH:mm:ssZ")
$product = Api "POST" "/api/products" @{
    name = "MacBook Pro M3 Max 16 inch (Demo Buổi 15)"
    description = "Sản phẩm demo tự động cho buổi bảo vệ đồ án - Trạng thái Scheduled, tự động mở và đóng."
    startingPrice = 1000000
    stepPrice = 50000
    startTime = $start
    endTime = $end
    categoryId = 1
} $sellerToken

$prodId = $product.id
Write-Host "   Tạo sản phẩm thành công: Id = $prodId, Status = $($product.status)" -ForegroundColor Green

Write-Host "`n== 6. Chờ Worker nền tự động mở phiên (Mỗi 5 giây quét 1 lần)... ==" -ForegroundColor Yellow
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 3
    $p = Api "GET" "/api/products/$prodId" $null $null
    Write-Host "   Đang chờ mở phiên... Trạng thái: $($p.status)"
    if ($p.status -eq "Active") { break }
}

Write-Host "`n== 7. Kiểm thử các luồng Đặt giá (Bắt lỗi & Thành công) ==" -ForegroundColor Yellow
Write-Host "   7a. Người bán tự đặt giá (Kỳ vọng 403 seller_cannot_bid):"
$err403 = Api "POST" "/api/products/$prodId/bids" @{ amount = 2000000 } $sellerToken
Write-Host "       $(ConvertTo-Json $err403 -Compress)" -ForegroundColor Magenta

Write-Host "   7b. Bidder đặt giá < Giá khởi điểm (Kỳ vọng 400 bid_too_low):"
$err400 = Api "POST" "/api/products/$prodId/bids" @{ amount = 500000 } $bidderToken
Write-Host "       $(ConvertTo-Json $err400 -Compress)" -ForegroundColor Magenta

Write-Host "   7c. Bidder 1 đặt giá hợp lệ = 1,000,000 VND (Kỳ vọng 201 Created):"
$ok1 = Api "POST" "/api/products/$prodId/bids" @{ amount = 1000000 } $bidderToken
Write-Host "       $(ConvertTo-Json $ok1 -Compress)" -ForegroundColor Green

Write-Host "   7d. Bidder 2 đặt giá vượt mặt = 1,100,000 VND (Kỳ vọng 201 Created + Outbid thông báo):"
$ok2 = Api "POST" "/api/products/$prodId/bids" @{ amount = 1100000 } $bidder2Token
Write-Host "       $(ConvertTo-Json $ok2 -Compress)" -ForegroundColor Green

Write-Host "`n== 8. Chờ phiên kết thúc để Worker chốt đơn hàng và gửi thông báo... ==" -ForegroundColor Yellow
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 3
    $p = Api "GET" "/api/products/$prodId" $null $null
    Write-Host "   Đang chờ đóng phiên... Trạng thái: $($p.status)"
    if ($p.status -eq "Completed") { break }
}

Write-Host "`n== 9. Kiểm tra Đơn hàng phát sinh (Orders) & Thông báo (Notifications) ==" -ForegroundColor Yellow
Write-Host "   - Đơn hàng của người thắng cuộc (bidder2):"
$orders = Api "GET" "/api/orders/me" $null $bidder2Token
Write-Host "     $(ConvertTo-Json $orders -Depth 3)" -ForegroundColor Cyan

Write-Host "   - Thông báo nhận được của bidder 1 (bị vượt giá):"
$notifs1 = Api "GET" "/api/notifications/me" $null $bidderToken
Write-Host "     $(ConvertTo-Json $notifs1 -Depth 3)" -ForegroundColor Cyan

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " HOÀN TẤT KỊCH BẢN DEMO TOÀN DIỆN 7 BẢNG SẴN SÀNG BẢO VỆ!  " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
