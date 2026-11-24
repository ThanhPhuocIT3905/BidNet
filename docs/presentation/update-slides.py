"""Update the PowerPoint COM source to the verified seven-table BidNet system.
Run before make-pptx.ps1. Writes UTF-8 BOM for Windows PowerShell 5.1.
"""
from pathlib import Path
import sys

p = Path(__file__).with_name('make-pptx.ps1')
s = p.read_text(encoding='utf-8-sig')
if '# ============ SLIDE 4 — THIẾT KẾ 7 BẢNG' in s:
    print('Already updated:', p)
    sys.exit(0)

def replace(a, b):
    global s
    if a not in s:
        raise RuntimeError(f'Missing anchor: {a[:70]}')
    s = s.replace(a, b)

replace('"Thuyết trình môn học — BidNet Backend"', '"Lập trình Web 2 — Đồ án BidNet"')
replace('"Mục tiêu phiên bản 1"', '"Mục tiêu phiên bản hiện tại"')
replace('• Theo dõi phiên đấu giá', '• Theo dõi đơn hàng')
replace('• Theo dõi kết quả', '• Nhận thông báo / giao hàng')
replace('$goals = @("Đảm bảo giá đấu tăng hợp lệ.", "Tự động mở và đóng phiên.", "Xác định người thắng chính xác.", "Cập nhật giá theo thời gian thực.")',
        '$goals = @("Đặt giá an toàn, đúng bước giá.", "Tự động mở, đóng phiên.", "Chốt đơn hàng khi có người thắng.", "Danh mục + thông báo cá nhân.")')
replace('Lưu ý: Chưa triển khai thanh toán, đặt cọc và ví điện tử.', 'Lưu ý: Trạng thái Paid được cập nhật thủ công; chưa tích hợp cổng thanh toán.')
replace('Set-Notes $s "BidNet hướng đến việc giải quyết quá trình đấu giá trực tuyến',
        'Set-Notes $s "Môn học Lập trình Web 2. BidNet hướng đến việc giải quyết quá trình đấu giá trực tuyến')
replace('Trong phiên bản hiện tại, nhóm tập trung vào tính chính xác của nghiệp vụ đấu giá, chưa triển khai thanh toán thực tế.',
        'Phiên bản hiện tại có 7 bảng: thêm Categories, Orders và Notifications. Worker tạo đơn Pending cùng thông báo cho người thắng và người bán; trạng thái Paid là cập nhật thủ công, chưa có cổng thanh toán.')
replace('"Tự động đóng phiên"', '"Đóng phiên + tạo đơn"')
replace('Controller chỉ tiếp nhận yêu cầu — toàn bộ nghiệp vụ nằm ở Service.',
        'Nghiệp vụ đấu giá ở Service; danh mục, đơn và thông báo hiện xử lý tại Controller.')
replace('Ngoài ra, hệ thống có Background Worker để tự động quản lý vòng đời phiên đấu giá và SignalR',
        'Các API Categories, Orders, Notifications hiện dùng AppDbContext trực tiếp trong Controller. Background Worker tự chốt đơn hàng, tạo thông báo và SignalR')

start = s.index('# ============ SLIDE 4 —')
end = s.index('# ============ SLIDE 5 —', start)
s = s[:start] + '''# ============ SLIDE 4 — THIẾT KẾ 7 BẢNG ============
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

''' + s[end:]
replace('Nếu không có lượt đặt giá, phiên kết thúc mà không có người thắng.',
        'Nếu không có lượt đặt giá, phiên kết thúc mà không có người thắng và không tạo đơn. Có bid thì worker tạo Orders trạng thái Pending và hai Notifications.')
replace('"Thông báo", "Commit xong → SignalR"', '"Thông báo", "Outbid + SignalR sau commit"')
replace('SignalR chỉ gửi thông báo sau khi dữ liệu đã được commit.', 'Thông báo outbid và thông báo người bán được lưu cùng bid; SignalR chỉ phát sau khi commit.')
replace('"Đăng nhập / đăng ký", "10 request/phút/IP"', '"Đăng nhập / đăng ký", "10 request/phút/IP"')
replace('Set-Notes $s "Hệ thống sử dụng SignalR', 'Set-Notes $s "Hệ thống có thông báo lưu trong Notifications (outbid, bid mới cho seller, thắng phiên) và SignalR')
replace('"Hạn chế: Chưa có thanh toán thực tế và frontend trong repository backend."',
        '"Hạn chế: Paid là trạng thái thủ công; chưa có cổng thanh toán và frontend trong repo."')
replace('"Tự động quản lý phiên", "Worker mở, đóng phiên và xác định người thắng."',
        '"Khép kín đấu giá → đơn", "Worker chốt đơn Pending và gửi thông báo."')
replace('"Cập nhật realtime", "SignalR thông báo sau khi dữ liệu commit."',
        '"7 bảng + realtime", "Danh mục, đơn, thông báo và SignalR."')
replace('11/11 test; 4 bảng và 4 migration;', '11/11 test; 7 bảng và 5 migrations;')
replace('Hệ thống hiện chưa triển khai thanh toán thực tế và frontend trong repository backend.',
        'Hệ thống hiện có Orders và Notifications; trạng thái Paid là cập nhật thủ công, chưa tích hợp cổng thanh toán; frontend không nằm trong repository backend.')
replace('rate limit đăng nhập 10 request/phút/IP', 'rate limit đăng nhập 10 request/phút/IP')
p.write_text(s, encoding='utf-8-sig')
print('Updated', p)
