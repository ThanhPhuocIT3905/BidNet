# ============================================================
# make-pptx.ps1 — BidNet 10 slide (bản rút gọn theo góp ý giảng viên)
# Chạy:  powershell -ExecutionPolicy Bypass -File make-pptx.ps1
# Yêu cầu: Microsoft PowerPoint đã cài; ảnh trong screenshots/
# Nguyên tắc: slide chỉ nêu ý chính + sơ đồ, giải thích chi tiết nằm ở Notes
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root  = "D:\all_my_project\BidNet\docs\presentation"
$shots = Join-Path $root "screenshots"
$outFile = Join-Path $root "BidNet-ThuyetTrinh-10-slide.pptx"
if (Test-Path $outFile) { Remove-Item $outFile -Force }

function RGB($r, $g, $b) { return [int]($r + ($g -shl 8) + ($b -shl 16)) }
$NAVY    = RGB 15 23 42
$BLUE    = RGB 30 58 138
$ACCENT  = RGB 37 99 235
$GREEN   = RGB 21 128 61
$GREENBG = RGB 240 253 244
$RED     = RGB 185 28 28
$REDBG   = RGB 254 242 242
$AMBER   = RGB 180 83 9
$AMBERBG = RGB 255 247 237
$SLATE   = RGB 51 65 85
$MUTED   = RGB 100 116 139
$WHITE   = RGB 255 255 255
$LIGHT   = RGB 248 250 252
$SOFT    = RGB 239 246 255
$BORDER  = RGB 203 213 225
$LINE    = RGB 148 163 184

$pp = New-Object -ComObject PowerPoint.Application
$pp.Visible = -1
$pp.DisplayAlerts = 1
$pres = $pp.Presentations.Add()
$pres.PageSetup.SlideSize = 15
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540
Write-Host "Slide size: $($pres.PageSetup.SlideWidth) x $($pres.PageSetup.SlideHeight) pt"

# ---------------- helpers ----------------
function Add-Box($slide, $x, $y, $w, $h, $fill, $lineColor, $radiusShape = 5) {
    $s = $slide.Shapes.AddShape($radiusShape, $x, $y, $w, $h)
    $s.Fill.ForeColor.RGB = $fill
    if ($null -eq $lineColor) { $s.Line.Visible = 0 }
    else { $s.Line.ForeColor.RGB = $lineColor; $s.Line.Weight = 1 }
    return $s
}

function Add-Text($slide, $x, $y, $w, $h, $text, $size, $bold, $color, $align = 1, $font = "Segoe UI") {
    $tb = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    $tf = $tb.TextFrame
    $tf.MarginLeft = 0; $tf.MarginRight = 0; $tf.MarginTop = 0; $tf.MarginBottom = 0
    $tf.WordWrap = -1
    $tr = $tf.TextRange
    $tr.Text = $text
    $tr.Font.Name = $font
    $tr.Font.Size = [int][math]::Round([double]$size)
    $tr.Font.Bold = $(if ($bold) { -1 } else { 0 })
    $tr.Font.Color.RGB = $color
    $tr.ParagraphFormat.Alignment = $align
    $tr.ParagraphFormat.SpaceAfter = 0
    return $tb
}

function Add-Line($slide, $x1, $y1, $x2, $y2, $color, $dash = 0, $weight = 1) {
    $ln = $slide.Shapes.AddLine($x1, $y1, $x2, $y2)
    $ln.Line.ForeColor.RGB = $color
    $ln.Line.Weight = $weight
    if ($dash -ne 0) { $ln.Line.DashStyle = $dash }
    return $ln
}

function Add-ArrowRight($slide, $x, $y, $w, $h, $color) {
    $a = $slide.Shapes.AddShape(33, $x, $y, $w, $h)
    $a.Fill.ForeColor.RGB = $color; $a.Line.Visible = 0
    return $a
}

function Add-ArrowDown($slide, $x, $y, $w, $h, $color) {
    $a = $slide.Shapes.AddShape(36, $x, $y, $w, $h)
    $a.Fill.ForeColor.RGB = $color; $a.Line.Visible = 0
    return $a
}

function Add-PictureFit($slide, $path, $x, $y, $w, $h) {
    $im = [System.Drawing.Image]::FromFile($path)
    $iw = $im.Width; $ih = $im.Height; $im.Dispose()
    $scale = [Math]::Min($w / $iw, $h / $ih)
    $pw = [Math]::Round($iw * $scale); $ph = [Math]::Round($ih * $scale)
    $px = [Math]::Round($x + ($w - $pw) / 2); $py = [Math]::Round($y + ($h - $ph) / 2)
    return $slide.Shapes.AddPicture($path, 0, -1, $px, $py, $pw, $ph)
}

function New-Slide($title, $sub, $num, $total = 10) {
    $s = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    Add-Box $s 0 0 960 8 $ACCENT $null 1 | Out-Null
    Add-Text $s 40 20 880 44 $title 27 $true $BLUE 1 | Out-Null
    Add-Box $s 40 70 110 4 $ACCENT $null 1 | Out-Null
    if ($sub) { Add-Text $s 40 80 880 22 $sub 13 $false $MUTED 1 | Out-Null }
    Add-Text $s 890 520 40 18 "$num/$total" 10 $false $MUTED 3 | Out-Null
    return $s
}

function Set-Notes($slide, $text) {
    try {
        foreach ($ph in $slide.NotesPage.Shapes.Placeholders) {
            if ($ph.PlaceholderFormat.Type -eq 2) { $ph.TextFrame.TextRange.Text = $text; break }
        }
    } catch { }
}

# ============ SLIDE 1 — GIỚI THIỆU ĐỀ TÀI ============
$s = $pres.Slides.Add(1, 12)
Add-Box $s 0 0 960 540 $NAVY $null 1 | Out-Null
Add-Box $s 0 0 960 6 $ACCENT $null 1 | Out-Null
Add-Text $s 60 96 840 90 "BidNet" 64 $true $WHITE 2 | Out-Null
Add-Text $s 60 196 840 34 "XÂY DỰNG HỆ THỐNG SÀN ĐẤU GIÁ TRỰC TUYẾN" 19 $true (RGB 191 219 254) 2 | Out-Null
Add-Box $s 430 248 100 3 $ACCENT $null 1 | Out-Null
$tech = @(
    @("BACKEND", "ASP.NET Core 10"),
    @("DATABASE", "SQL Server"),
    @("REALTIME", "SignalR"),
    @("AUTHENTICATION", "JWT")
)
for ($i = 0; $i -lt 4; $i++) {
    $x = 50 + $i * 220
    Add-Box $s $x 292 200 66 (RGB 30 41 59) (RGB 59 130 246) 5 | Out-Null
    Add-Text $s $x 302 200 16 $tech[$i][0] 9.5 $true (RGB 148 163 184) 2 | Out-Null
    Add-Text $s $x 322 200 26 $tech[$i][1] 14 $true $WHITE 2 | Out-Null
}
Add-Text $s 60 414 840 28 "Người thực hiện: ..................................................." 14 $false (RGB 203 213 225) 2 | Out-Null
Add-Text $s 60 446 840 28 "Lớp: ..................................................." 14 $false (RGB 203 213 225) 2 | Out-Null
Add-Text $s 60 504 840 22 "Lập trình Web 2 — Đồ án BidNet" 10 $false (RGB 100 116 139) 2 | Out-Null
Set-Notes $s "Kính chào thầy và các bạn. Nhóm em xin trình bày đề tài xây dựng hệ thống sàn đấu giá trực tuyến BidNet. Hệ thống cho phép người bán đăng sản phẩm, người mua tham gia trả giá và tự động xác định người thắng khi phiên đấu giá kết thúc."

# ============ SLIDE 2 — BÀI TOÁN VÀ MỤC TIÊU ============
$s = New-Slide "Bài toán và mục tiêu hệ thống" "BidNet giải quyết bài toán gì?" 2
Add-Box $s 40 104 430 186 $GREENBG $GREEN 5 | Out-Null
Add-Text $s 62 120 386 24 "NGƯỜI BÁN" 14 $true $GREEN 1 | Out-Null
Add-Line $s 62 150 448 150 $BORDER 0 1 | Out-Null
Add-Text $s 62 162 386 112 "• Đăng sản phẩm`r`n• Thiết lập thời gian`r`n• Theo dõi đơn hàng" 14.5 $false $SLATE 1 | Out-Null
Add-Box $s 490 104 430 186 $SOFT $ACCENT 5 | Out-Null
Add-Text $s 512 120 386 24 "NGƯỜI MUA" 14 $true $ACCENT 1 | Out-Null
Add-Line $s 512 150 898 150 $BORDER 0 1 | Out-Null
Add-Text $s 512 162 386 112 "• Xem sản phẩm`r`n• Tham gia đặt giá`r`n• Nhận thông báo / giao hàng" 14.5 $false $SLATE 1 | Out-Null

Add-Text $s 40 306 880 24 "Mục tiêu phiên bản hiện tại" 15 $true $BLUE 1 | Out-Null
$goals = @("Đặt giá an toàn, đúng bước giá.", "Tự động mở, đóng phiên.", "Chốt đơn hàng khi có người thắng.", "Danh mục + thông báo cá nhân.")
$gpos = @(@(40, 338), @(490, 338), @(40, 390), @(490, 390))
for ($i = 0; $i -lt 4; $i++) {
    $gx = $gpos[$i][0]; $gy = $gpos[$i][1]
    Add-Box $s $gx $gy 430 44 $LIGHT $BORDER 5 | Out-Null
    Add-Box $s ($gx + 12) ($gy + 11) 22 22 $GREENBG $GREEN 9 | Out-Null
    Add-Text $s ($gx + 12) ($gy + 14) 22 16 "✓" 11 $true $GREEN 2 | Out-Null
    Add-Text $s ($gx + 44) ($gy + 13) 372 20 $goals[$i] 13 $false $SLATE 1 | Out-Null
}
Add-Box $s 40 446 880 34 $AMBERBG $null 5 | Out-Null
Add-Text $s 58 454 844 20 "Lưu ý: Trạng thái Paid được cập nhật thủ công; chưa tích hợp cổng thanh toán." 12.5 $true $AMBER 1 | Out-Null
Set-Notes $s "Môn học Lập trình Web 2. BidNet hướng đến việc giải quyết quá trình đấu giá trực tuyến giữa người bán và người mua. Người bán tạo phiên đấu giá với sản phẩm và thời gian cụ thể. Người mua tham gia trả giá theo quy tắc tăng dần. Khi hết thời gian, hệ thống tự động xác định người thắng. Phiên bản hiện tại có 7 bảng: thêm Categories, Orders và Notifications. Worker tạo đơn Pending cùng thông báo cho người thắng và người bán; trạng thái Paid là cập nhật thủ công, chưa có cổng thanh toán. Số liệu cần nhớ: bước giá tối thiểu 1.000 VND; mỗi phiên chỉ có tối đa một người thắng."

# ============ SLIDE 3 — CÔNG NGHỆ VÀ KIẾN TRÚC ============
$s = New-Slide "Công nghệ và kiến trúc hệ thống" "Client gửi yêu cầu → Controller → Service → EF Core → SQL Server" 3
Add-Box $s 206 110 548 180 $SOFT $null 5 | Out-Null
Add-Text $s 206 116 548 18 "ASP.NET Core Web API" 11 $true $ACCENT 2 | Out-Null
$arch = @(
    @("Client / Swagger", "Gửi HTTP request`r`nnhận response"),
    @("Controller", "Tiếp nhận yêu cầu"),
    @("Service", "Xử lý nghiệp vụ"),
    @("EF Core", "Truy cập dữ liệu"),
    @("SQL Server", "Lưu dữ liệu")
)
$x = 40
foreach ($b in $arch) {
    Add-Box $s $x 144 152 126 $WHITE $ACCENT 5 | Out-Null
    Add-Text $s $x 170 152 24 $b[0] 15 $true $BLUE 2 | Out-Null
    Add-Text $s ($x + 8) 202 136 48 $b[1] 11.5 $false $SLATE 2 | Out-Null
    $x += 182
}
foreach ($ax in @(194, 376, 558, 740)) { Add-ArrowRight $s $ax 199 26 16 $ACCENT | Out-Null }
Add-Line $s 480 270 480 306 $LINE 4 | Out-Null
Add-Line $s 175 306 785 306 $LINE 4 | Out-Null
Add-Line $s 175 306 175 320 $LINE 4 | Out-Null
Add-Line $s 480 306 480 320 $LINE 4 | Out-Null
Add-Line $s 785 306 785 320 $LINE 4 | Out-Null
$bottom = @(
    @(40,  "Background Worker", "Đóng phiên + tạo đơn", "Quét 5 giây/lần"),
    @(345, "SignalR", "Cập nhật realtime", "Giá mới và kết quả"),
    @(650, "Cloudinary", "Lưu trữ hình ảnh sản phẩm", "")
)
foreach ($b in $bottom) {
    $bx = $b[0]
    Add-Box $s $bx 320 270 110 $LIGHT $BORDER 5 | Out-Null
    Add-Text $s $bx 334 270 22 $b[1] 14 $true $BLUE 2 | Out-Null
    Add-Text $s ($bx + 14) 362 242 20 $b[2] 11.5 $true $SLATE 2 | Out-Null
    if ($b[3] -ne "") { Add-Text $s ($bx + 14) 384 242 20 $b[3] 11 $false $MUTED 2 | Out-Null }
}
Add-Text $s 40 444 880 26 "Nghiệp vụ đấu giá ở Service; danh mục, đơn và thông báo hiện xử lý tại Controller." 12.5 $true $BLUE 2 | Out-Null
Set-Notes $s "Hệ thống sử dụng kiến trúc ASP.NET Core Web API. Khi người dùng gửi yêu cầu, Controller tiếp nhận và chuyển đến Service xử lý nghiệp vụ. Entity Framework Core đảm nhiệm việc truy cập SQL Server. Các API Categories, Orders, Notifications hiện dùng AppDbContext trực tiếp trong Controller. Background Worker tự chốt đơn hàng, tạo thông báo và SignalR để cập nhật thông tin theo thời gian thực. Hình ảnh sản phẩm được lưu trên Cloudinary. Số liệu cần nhớ: ASP.NET Core 10, EF Core + SQL Server; worker quét 5 giây một lần, tối đa 50 phiên mỗi lượt."

# ============ SLIDE 4 — THIẾT KẾ 7 BẢNG ============
$s = New-Slide "Thiết kế cơ sở dữ liệu" "7 bảng nghiệp vụ — mỗi quan hệ được ràng buộc bằng khóa ngoại" 4
$tables = @(
    @("Users", "Id • Username • Role", "Tài khoản / phân quyền"),
    @("Categories", "Id • Name (unique)", "Danh mục sản phẩm"),
    @("Products", "SellerId • CategoryId", "Phiên / RowVersion"),
    @("Bids", "ProductId • UserId", "Lịch sử đặt giá"),
    @("ProductImages", "ProductId • Url", "Ảnh của sản phẩm"),
    @("Orders", "ProductId (unique)", "Đơn sau khi thắng"),
    @("Notifications", "UserId • IsRead", "Thông báo cá nhân")
)
for ($i = 0; $i -lt 7; $i++) {
    $col = $i % 4; $row = [int][math]::Floor($i / 4)
    $x = 40 + $col * 225; $y = 106 + $row * 150
    Add-Box $s $x $y 205 128 $WHITE $BORDER 5 | Out-Null
    Add-Box $s $x $y 205 5 $ACCENT $null 1 | Out-Null
    Add-Text $s ($x + 13) ($y + 18) 180 24 $tables[$i][0] 15 $true $BLUE 1 | Out-Null
    Add-Text $s ($x + 13) ($y + 51) 180 35 $tables[$i][2] 11.5 $false $SLATE 1 | Out-Null
    Add-Text $s ($x + 13) ($y + 99) 180 18 $tables[$i][1] 10 $false $MUTED 1 | Out-Null
}
Add-Box $s 730 256 190 128 $SOFT $BORDER 5 | Out-Null
Add-Text $s 744 272 164 98 "Categories 1—N Products`r`nProducts 1—N Bids / Images`r`nProducts 1—0..1 Orders`r`nUsers 1—N Notifications" 10.5 $true $SLATE 1 | Out-Null
Add-Text $s 40 408 880 24 "Orders: BuyerId và SellerId tham chiếu Users • ProductId unique" 13 $true $BLUE 2 | Out-Null
Add-Box $s 40 450 880 38 $GREENBG $null 5 | Out-Null
Add-Text $s 56 459 848 20 "5 migrations  •  7 bảng ứng dụng  •  decimal(18,2)  •  RowVersion" 13 $true $GREEN 2 | Out-Null
Set-Notes $s "CSDL có 7 bảng nghiệp vụ: Users, Products, ProductImages, Bids, Categories, Orders, Notifications. Categories–Products là 1–N; Products–Bids và Products–ProductImages là 1–N; Products–Orders là 1–0..1 nhờ unique Order.ProductId. Users liên hệ với Products qua SellerId/WinnerId, Bids qua UserId, Orders qua BuyerId/SellerId và Notifications qua UserId. CategoryId tùy chọn để giữ dữ liệu cũ. Tiền decimal(18,2), Product.RowVersion chống xung đột; unique Username, Email, Category.Name. Có 5 migrations, 7 bảng ứng dụng (không tính __EFMigrationsHistory). Migration mới: 20261124030551_AddCategoriesOrdersNotifications. Không nói rằng đã xử lý thanh toán thật."

# ============ SLIDE 5 — VÒNG ĐỜI PHIÊN ============
$s = New-Slide "Vòng đời phiên đấu giá" "Worker tự chuyển trạng thái theo thời gian" 5
$states = @(
    @(60,  "SCHEDULED", "Chờ đến thời gian bắt đầu", $AMBER, $AMBERBG),
    @(370, "ACTIVE",    "Đang diễn ra đấu giá", $GREEN, $GREENBG),
    @(680, "COMPLETED", "Kết thúc và xác định người thắng", $ACCENT, $SOFT)
)
foreach ($st in $states) {
    Add-Box $s $st[0] 118 220 122 $st[4] $st[3] 5 | Out-Null
    Add-Text $s $st[0] 136 220 24 $st[1] 16 $true $st[3] 2 | Out-Null
    Add-Text $s ($st[0] + 16) 176 188 52 $st[2] 12 $false $SLATE 2 | Out-Null
}
Add-ArrowRight $s 290 171 60 18 $ACCENT | Out-Null
Add-ArrowRight $s 600 171 60 18 $ACCENT | Out-Null
Add-Text $s 280 196 80 18 "đến StartTime" 10.5 $false $MUTED 2 | Out-Null
Add-Text $s 590 196 80 18 "hết EndTime" 10.5 $false $MUTED 2 | Out-Null
Add-ArrowDown $s 471 244 18 52 $RED | Out-Null
Add-Text $s 500 258 210 20 "Admin hủy phiên" 10.5 $false $MUTED 1 | Out-Null
Add-Box $s 370 300 220 88 $REDBG $RED 5 | Out-Null
Add-Text $s 370 314 220 22 "CANCELLED" 15 $true $RED 2 | Out-Null
Add-Text $s 386 342 188 36 "Admin hủy phiên vi phạm" 12 $false $SLATE 2 | Out-Null
$stats = @(
    @(40, "5 giây", "Chu kỳ kiểm tra của Background Worker"),
    @(490, "50 phiên", "Mỗi lần xử lý tối đa")
)
foreach ($st in $stats) {
    Add-Box $s $st[0] 410 430 64 $SOFT $BORDER 5 | Out-Null
    Add-Text $s ($st[0] + 20) 420 200 32 $st[1] 24 $true $ACCENT 1 | Out-Null
    Add-Text $s ($st[0] + 20) 452 394 18 $st[2] 11.5 $false $SLATE 1 | Out-Null
}
Set-Notes $s "Một phiên đấu giá có ba trạng thái chính: Scheduled, Active và Completed. Worker chạy định kỳ 5 giây để kiểm tra thời gian và tự động chuyển trạng thái. Khi phiên kết thúc, hệ thống chọn người có giá đặt cao nhất. Nếu có nhiều người đặt cùng mức giá, người đặt trước sẽ thắng. Nếu không có lượt đặt giá, phiên kết thúc mà không có người thắng và không tạo đơn. Có bid thì worker tạo Orders trạng thái Pending và hai Notifications. Admin cũng có thể hủy phiên vi phạm. Số liệu cần nhớ: worker 5 giây một lần, tối đa 50 phiên mỗi lượt; hòa giá thì lượt đặt sớm hơn thắng; không có lượt đặt thì WinnerId bằng null."

# ============ SLIDE 6 — XÁC THỰC VÀ PHÂN QUYỀN ============
$s = New-Slide "Xác thực và phân quyền" "Quy trình xác thực người dùng qua 3 bước" 6
$steps = @(
    @("Đăng ký tài khoản", "Mật khẩu được băm bằng PBKDF2-SHA256 và salt."),
    @("Đăng nhập", "Kiểm tra thông tin và cấp JWT."),
    @("Truy cập API", "JWT xác định người dùng và vai trò.")
)
$xs = @(40, 345, 650)
for ($i = 0; $i -lt 3; $i++) {
    $x = $xs[$i]
    Add-Box $s $x 104 270 176 $WHITE $BORDER 5 | Out-Null
    Add-Box $s ($x + 18) 120 34 34 $ACCENT $null 9 | Out-Null
    Add-Text $s ($x + 18) 127 34 20 "$($i + 1)" 14 $true $WHITE 2 | Out-Null
    Add-Text $s ($x + 64) 126 188 24 $steps[$i][0] 15 $true $BLUE 1 | Out-Null
    Add-Text $s ($x + 18) 176 234 76 $steps[$i][1] 12.5 $false $SLATE 1 | Out-Null
}
Add-ArrowRight $s 313 184 26 16 $ACCENT | Out-Null
Add-ArrowRight $s 618 184 26 16 $ACCENT | Out-Null
Add-Box $s 40 300 430 86 $SOFT $BORDER 5 | Out-Null
Add-Text $s 58 312 200 18 "PBKDF2" 12 $true $MUTED 1 | Out-Null
Add-Text $s 58 332 300 34 "210.000 vòng lặp" 24 $true $ACCENT 1 | Out-Null
Add-Text $s 58 366 394 18 "Băm mật khẩu SHA-256 + salt 16 byte" 11 $false $SLATE 1 | Out-Null
Add-Box $s 490 300 430 86 $SOFT $BORDER 5 | Out-Null
Add-Text $s 508 312 200 18 "JWT" 12 $true $MUTED 1 | Out-Null
Add-Text $s 508 332 300 34 "60 phút" 24 $true $ACCENT 1 | Out-Null
Add-Text $s 508 366 394 18 "Ký HMAC-SHA256, hết hạn phải đăng nhập lại" 11 $false $SLATE 1 | Out-Null
Add-Box $s 40 402 880 64 $AMBERBG $null 5 | Out-Null
Add-Text $s 58 414 844 20 "Điểm bảo mật" 12 $true $AMBER 1 | Out-Null
Add-Text $s 58 434 844 22 "Admin khóa tài khoản → hệ thống kiểm tra lại trạng thái trong DB và chặn thao tác nhạy cảm ngay." 12.5 $false $SLATE 1 | Out-Null
Set-Notes $s "Về xác thực, hệ thống sử dụng PBKDF2-SHA256 để băm mật khẩu với 210.000 vòng lặp và salt. Khi đăng nhập thành công, hệ thống cấp JWT có thời hạn 60 phút. Token được sử dụng để xác định người dùng và phân quyền khi gọi API. Một điểm quan trọng là khi Admin khóa tài khoản, hệ thống đọc lại trạng thái tài khoản trong database ở các thao tác nhạy cảm, do đó người dùng không thể tiếp tục thao tác chỉ vì token vẫn còn hạn. Số liệu cần nhớ: PBKDF2-SHA256 210.000 vòng, salt 16 byte; JWT ký HMAC-SHA256, hạn 60 phút; đăng ký luôn gán Role là User; so sánh hash bằng FixedTimeEquals."

# ============ SLIDE 7 — ĐẶT GIÁ VÀ CHỐNG TRANH CHẤP ============
$s = New-Slide "Quy trình đặt giá và chống tranh chấp" "Một lượt đặt giá diễn ra như thế nào?" 7
$flow = @(
    @("Gửi giá", "Người mua gửi mức giá mới"),
    @("Kiểm tra quyền", "Tài khoản và quyền đặt giá"),
    @("Kiểm tra giá", "Thời gian và bước giá 1.000đ"),
    @("Lưu một lần", "Ghi Bid + CurrentPrice"),
    @("Thông báo", "Outbid + SignalR sau commit")
)
$x = 40
for ($i = 0; $i -lt 5; $i++) {
    Add-Box $s $x 124 160 118 $WHITE $BORDER 5 | Out-Null
    Add-Box $s ($x + 67) 136 26 26 $ACCENT $null 9 | Out-Null
    Add-Text $s ($x + 67) 142 26 16 "$($i + 1)" 12 $true $WHITE 2 | Out-Null
    Add-Text $s $x 170 160 20 $flow[$i][0] 13 $true $BLUE 2 | Out-Null
    Add-Text $s ($x + 10) 196 140 40 $flow[$i][1] 10.5 $false $SLATE 2 | Out-Null
    $x += 180
}
foreach ($ax in @(202, 382, 562, 742)) { Add-ArrowRight $s $ax 175 16 16 $ACCENT | Out-Null }

Add-Text $s 40 264 500 20 "Cơ chế chống tranh chấp" 13 $true $RED 1 | Out-Null
Add-Box $s 40 312 200 72 $LIGHT $BORDER 5 | Out-Null
Add-Text $s 48 328 184 36 "A và B cùng đặt giá" 12.5 $true $SLATE 2 | Out-Null
Add-ArrowRight $s 248 338 22 18 $ACCENT | Out-Null
Add-Box $s 278 312 200 72 $GREENBG $GREEN 5 | Out-Null
Add-Text $s 286 328 184 36 "A cập nhật thành công" 12.5 $true $GREEN 2 | Out-Null
Add-ArrowRight $s 486 338 22 18 $RED | Out-Null
Add-Box $s 516 312 180 72 $REDBG $RED 5 | Out-Null
Add-Text $s 524 328 164 36 "B bị từ chối" 12.5 $true $RED 2 | Out-Null
Add-ArrowRight $s 704 338 22 18 $RED | Out-Null
Add-Box $s 734 312 186 72 $REDBG $RED 5 | Out-Null
Add-Text $s 742 324 170 20 "409 Conflict" 14 $true $RED 2 | Out-Null
Add-Text $s 742 348 170 20 "Không ghi đè giá" 10.5 $false $SLATE 2 | Out-Null
Add-Text $s 40 400 880 40 "RowVersion phát hiện dữ liệu đã thay đổi → request đến sau không ghi đè giá đã cập nhật." 12.5 $true $SLATE 2 | Out-Null
Set-Notes $s "Khi người mua đặt giá, hệ thống kiểm tra tài khoản, quyền đặt giá, thời gian và mức giá. Giá đặt phải lớn hơn hoặc bằng giá hiện tại cộng bước giá 1.000 đồng. Sau đó, BidService ghi lịch sử đặt giá và cập nhật giá hiện tại trong cùng một lần SaveChanges. Nếu hai người đặt giá đồng thời, RowVersion giúp phát hiện dữ liệu đã bị thay đổi. Người cập nhật sau sẽ nhận lỗi 409 Conflict thay vì ghi đè dữ liệu của người trước. Thông báo outbid và thông báo người bán được lưu cùng bid; SignalR chỉ phát sau khi commit. Số liệu cần nhớ: bước giá 1.000 VND; lượt đầu phải lớn hơn hoặc bằng giá khởi điểm; một SaveChanges ghi cả Bid và CurrentPrice; xung đột trả 409 bid_conflict."

# ============ SLIDE 8 — REALTIME VÀ BẢO MẬT ============
$s = New-Slide "Realtime và bảo mật hệ thống" "" 8
Add-Text $s 40 96 500 22 "Realtime với SignalR" 14 $true $BLUE 1 | Out-Null
$buyers = @("Người mua A", "Người mua B", "Người mua C")
for ($i = 0; $i -lt 3; $i++) {
    $bx = 40 + $i * 160
    Add-Box $s $bx 126 140 46 $LIGHT $BORDER 5 | Out-Null
    Add-Text $s $bx 139 140 20 $buyers[$i] 12 $true $SLATE 2 | Out-Null
}
Add-Line $s 110 172 110 186 $LINE 0 1 | Out-Null
Add-Line $s 270 172 270 186 $LINE 0 1 | Out-Null
Add-Line $s 430 172 430 186 $LINE 0 1 | Out-Null
Add-Line $s 110 186 430 186 $LINE 0 1 | Out-Null
Add-ArrowDown $s 261 186 18 22 $ACCENT | Out-Null
Add-Box $s 160 208 220 50 $SOFT $ACCENT 5 | Out-Null
Add-Text $s 160 223 220 22 "SignalR Hub" 13.5 $true $ACCENT 2 | Out-Null
Add-ArrowDown $s 261 262 18 24 $ACCENT | Out-Null
Add-Box $s 160 290 220 46 $LIGHT $BORDER 5 | Out-Null
Add-Text $s 160 304 220 20 "Nhóm auction:{id}" 12.5 $true $SLATE 2 | Out-Null
Add-ArrowDown $s 261 340 18 24 $ACCENT | Out-Null
Add-Box $s 100 368 340 54 $GREENBG $GREEN 5 | Out-Null
Add-Text $s 100 386 340 20 "BidAccepted / AuctionClosed" 12.5 $true $GREEN 2 | Out-Null
Add-Text $s 40 436 880 20 "Database là nguồn dữ liệu chính — SignalR chỉ đảm nhiệm thông báo." 12 $true $SLATE 2 | Out-Null

Add-Text $s 590 96 330 22 "Các lớp bảo mật" 14 $true $BLUE 1 | Out-Null
Add-Box $s 590 126 330 32 $BLUE $null 1 | Out-Null
Add-Text $s 602 134 150 18 "Cơ chế" 11.5 $true $WHITE 1 | Out-Null
Add-Text $s 760 134 150 18 "Giới hạn" 11.5 $true $WHITE 1 | Out-Null
$rows = @(
    @("Đăng nhập / đăng ký", "10 request/phút/IP"),
    @("Đặt giá", "30 request/phút/user"),
    @("Vượt giới hạn", "HTTP 429"),
    @("CORS", "1 frontend"),
    @("Token", "JWT xác thực")
)
$ry = 158
for ($i = 0; $i -lt 5; $i++) {
    $fill = $WHITE
    if ($i % 2 -ne 0) { $fill = $LIGHT }
    Add-Box $s 590 $ry 330 44 $fill $BORDER 1 | Out-Null
    Add-Text $s 602 ($ry + 13) 150 18 $rows[$i][0] 11.5 $true $SLATE 1 | Out-Null
    Add-Text $s 760 ($ry + 13) 160 18 $rows[$i][1] 11.5 $false $ACCENT 1 | Out-Null
    $ry += 44
}
Add-Line $s 750 126 750 378 $BORDER 0 1 | Out-Null
Set-Notes $s "Hệ thống có thông báo lưu trong Notifications (outbid, bid mới cho seller, thắng phiên) và SignalR để cập nhật giá và kết quả đấu giá đến những người đang theo dõi cùng một sản phẩm. Các sự kiện chỉ được gửi sau khi dữ liệu lưu thành công. Nếu mất kết nối, client cần gọi lại API để lấy dữ liệu mới nhất. Ngoài ra, hệ thống có giới hạn số request để chống spam, cấu hình CORS, HTTPS và chuẩn hóa phản hồi lỗi nhằm tăng khả năng bảo mật và theo dõi lỗi. Số liệu cần nhớ: rate limit đăng nhập 10 request/phút/IP, đặt giá 30 request/phút/user, vượt thì trả 429; CORS giới hạn 1 frontend; SignalR dùng access_token cho đường dẫn hub; database là nguồn sự thật."

# ============ SLIDE 9 — DEMO HỆ THỐNG THỰC TẾ ============
$s = New-Slide "Demo hệ thống thực tế" "Sản phẩm demo: iPhone 15 Pro Max" 9
Add-PictureFit $s (Join-Path $shots "02-product-4-response.png") 40 96 420 252 | Out-Null
Add-PictureFit $s (Join-Path $shots "03-bid-history-public.png") 500 96 420 252 | Out-Null
Add-Text $s 40 352 420 16 "GET /api/products/4 → 200" 10.5 $false $MUTED 2 | Out-Null
Add-Text $s 500 352 420 16 "GET /api/products/4/bids → 200" 10.5 $false $MUTED 2 | Out-Null
Add-Box $s 40 374 430 54 $LIGHT $BORDER 5 | Out-Null
Add-Text $s 58 381 200 14 "GIÁ KHỞI ĐIỂM" 10 $true $MUTED 1 | Out-Null
Add-Text $s 58 394 300 30 "100.000đ" 22 $true $SLATE 1 | Out-Null
Add-Box $s 490 374 430 54 $GREENBG $GREEN 5 | Out-Null
Add-Text $s 508 381 200 14 "GIÁ HIỆN TẠI" 10 $true $GREEN 1 | Out-Null
Add-Text $s 508 394 300 30 "150.000đ" 22 $true $GREEN 1 | Out-Null
$badges = @(
    @("201 Created", "Đặt giá hợp lệ", $GREEN, $GREENBG),
    @("403 Forbidden", "Người bán tự đặt giá", $RED, $REDBG),
    @("400 Bad Request", "Giá không hợp lệ", $AMBER, $AMBERBG),
    @("200 OK", "Lấy thông tin và lịch sử", $ACCENT, $SOFT)
)
for ($i = 0; $i -lt 4; $i++) {
    $bx = 40 + $i * 225
    Add-Box $s $bx 436 205 56 $badges[$i][3] $badges[$i][2] 5 | Out-Null
    Add-Text $s $bx 443 205 18 $badges[$i][0] 13.5 $true $badges[$i][2] 2 | Out-Null
    Add-Text $s $bx 464 205 16 $badges[$i][1] 10 $false $SLATE 2 | Out-Null
}
Set-Notes $s "Đây là kết quả demo trực tiếp trên hệ thống đang chạy. Nhóm sử dụng sản phẩm iPhone 15 Pro Max với giá khởi điểm 100.000 đồng. Sau hai lượt đặt giá hợp lệ, giá hiện tại đạt 150.000 đồng. Khi người bán tự đặt giá, hệ thống trả về 403. Khi đặt giá thấp hơn quy định, hệ thống trả về 400. Các API truy vấn sản phẩm và lịch sử đặt giá cũng hoạt động thành công. Số liệu cần nhớ: giá 100.000 đồng lên 150.000 đồng; các mã 201, 403, 400, 200; lịch sử công khai chỉ trả id, amount, bidTime, không lộ UserId."

# ============ SLIDE 10 — KIỂM THỬ VÀ KẾT LUẬN ============
$s = New-Slide "Kiểm thử và kết luận" "Kiểm thử tự động với xUnit" 10
Add-Box $s 40 104 290 250 $GREENBG $GREEN 5 | Out-Null
Add-Text $s 40 146 290 80 "11/11" 60 $true $GREEN 2 | Out-Null
Add-Text $s 40 232 290 30 "TEST PASSED" 20 $true $GREEN 2 | Out-Null
Add-Text $s 40 270 290 20 "Kết quả chạy dotnet test" 11.5 $false $SLATE 2 | Out-Null
Add-Text $s 40 294 290 20 "10 test nghiệp vụ + 1 test SQL Server" 10.5 $false $MUTED 2 | Out-Null
Add-Text $s 40 314 290 20 "kiểm tra RowVersion" 10.5 $false $MUTED 2 | Out-Null
Add-Text $s 360 104 560 22 "Ba kết quả nổi bật" 14 $true $BLUE 1 | Out-Null
$high = @(
    @("Đặt giá an toàn", "RowVersion và transaction chống ghi đè."),
    @("Khép kín đấu giá → đơn", "Worker chốt đơn Pending và gửi thông báo."),
    @("7 bảng + realtime", "Danh mục, đơn, thông báo và SignalR.")
)
for ($i = 0; $i -lt 3; $i++) {
    $ry = 136 + $i * 70
    Add-Box $s 360 $ry 560 62 $LIGHT $BORDER 5 | Out-Null
    Add-Box $s 374 ($ry + 14) 34 34 $ACCENT $null 9 | Out-Null
    Add-Text $s 374 ($ry + 21) 34 20 "$($i + 1)" 14 $true $WHITE 2 | Out-Null
    Add-Text $s 422 ($ry + 10) 480 20 $high[$i][0] 13.5 $true $BLUE 1 | Out-Null
    Add-Text $s 422 ($ry + 32) 480 20 $high[$i][1] 11.5 $false $SLATE 1 | Out-Null
}
Add-Box $s 40 366 880 32 $AMBERBG $null 5 | Out-Null
Add-Text $s 58 374 844 18 "Hạn chế: Paid là trạng thái thủ công; chưa có cổng thanh toán và frontend trong repo." 12 $false $AMBER 2 | Out-Null
Add-Text $s 40 410 880 60 "XIN CẢM ƠN!" 36 $true $BLUE 2 | Out-Null
Set-Notes $s "Qua quá trình kiểm thử, hệ thống đạt 11 trên 11 bài test hiện hữu. Trong đó có 10 bài test nghiệp vụ và một bài test sử dụng SQL Server thật để kiểm tra RowVersion. Chưa có test tích hợp riêng bao phủ toàn bộ Categories, Orders và Notifications; cần demo các API mới trên Swagger để bổ sung bằng chứng. Nhóm đã hoàn thành đặt giá an toàn, worker chốt đơn Pending và thông báo cá nhân. Paid là cập nhật thủ công, chưa tích hợp cổng thanh toán; frontend không nằm trong repository backend. Còn cảnh báo bảo mật NU1902/NU1903 cho phụ thuộc Pkcs 9.0.11 cần xử lý. Cảm ơn thầy và các bạn đã lắng nghe. Số liệu cần nhớ: 11/11 test hiện hữu; 7 bảng và 5 migrations; RowVersion kết hợp transaction; worker 5 giây một lần, tối đa 50 phiên."

# ============ LƯU ============
$pres.SaveAs($outFile)
$pres.Export((Join-Path $root "preview"), "PNG", 1280, 720) | Out-Null
$slideCount = $pres.Slides.Count
$pres.Close()
$pp.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()

$f = Get-Item $outFile
Write-Host "OK: $($f.FullName) | $([math]::Round($f.Length/1KB)) KB | $slideCount slides"
