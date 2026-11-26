# Rà soát nghiệp vụ và UI — 25/11/2026

## Kết quả có bằng chứng

- `dotnet test Tests/BidNet.Tests.csproj -p:BaseOutputPath=bin\verify\`: **37/37**.
- `py Tests/audit-live.py`: **37 kiểm tra API/SQL Server đạt**; kết quả ở `live-audit-results.json`.
- `py Tests/audit-ui.py`: **144/144** tổ hợp màn hình/vai trò/theme/kích thước đạt; kết quả ở `ui-audit-results.json`.
- `npm run build`: đạt. Rollup còn thông báo annotation của thư viện SignalR, không phải lỗi build.
- UI kiểm tra khách, người mua, người bán, Admin; 390/1440 px; sáng/tối. Kiểm tra lỗi JS, HTTP thất bại, ảnh hỏng đã tải, tràn ngang và form đặt giá theo quyền. Đây không phải 144 luồng giao dịch độc lập.
- Đã xem ảnh chụp trang chủ, chi tiết, đăng nhập và quản trị. Ảnh bằng chứng tại `C:\Users\works\AppData\Local\Temp\opencode\bidnet-workflow-audit`.
- Dữ liệu sau kiểm thử: 5 users, 16 products, 28 bids, 3 orders, 9 notifications; 0 admin bids; 0 QA products còn sót. Chỉ xóa fixture có prefix riêng do bài test tạo.

## Quy tắc vai trò

| Thao tác | Khách | Thành viên | Admin |
|---|---|---|---|
| Xem phiên/lịch sử công khai | Có | Có | Có |
| Đặt giá | Không | Có, không phải chủ phiên và phiên đang mở | Không |
| Đăng bán/sửa ảnh | Không | Có; sửa ảnh trước giờ mở và chưa có bid | Không |
| Xem đơn | Không | Chỉ người mua/người bán của đơn | Có |
| Sửa địa chỉ | Không | Chỉ người mua, đơn Pending/Paid | Không ghi đè địa chỉ người mua |
| Xác nhận nhận tiền/giao hàng | Không | Người bán của đơn | Có |
| Hủy phiên | Không | Không | Có, trước hạn kết thúc và có lý do |
| Quản lý tài khoản/danh mục | Không | Không | Có, quyền hiện tại được đọc từ DB |

Tài khoản khóa bị chặn khi thực hiện thao tác cần đăng nhập. Lượt giá đã chấp nhận trước lúc khóa vẫn là lịch sử có hiệu lực; khóa tài khoản không tự xóa cam kết hoặc tự đổi kết quả phiên.

## Các lỗi đã sửa

1. Admin từng có thể đặt giá và đăng bán: chặn trong service, cổng trang và các nút điều hướng; kiểm chứng POST trực tiếp trả 403.
2. Quyền Admin cũ trong JWT: thao tác quản trị đọc lại role đang lưu trong DB.
3. Địa chỉ đơn đã giao/hủy còn sửa được: chặn API và ẩn form.
4. Gửi lại Delivered làm đổi CompletedAt: chỉ thay ngày khi chuyển trạng thái thật.
5. Hai request cập nhật đơn có thể ghi đè nhau: thêm `Orders.RowVersion`; migration `20261125123553_OrderConcurrency` đã áp dụng.
6. Paid có thể chuyển Cancelled dù chưa có hoàn tiền: bỏ chuyển trạng thái này. Pending có thể Paid/Cancelled; Paid chỉ Delivered; trạng thái cuối không mở lại.
7. Xác nhận giao hàng thiếu địa chỉ: trả lỗi có giải thích.
8. Tên danh mục đổi nhưng sản phẩm vẫn giữ tên cũ: đồng bộ trong cùng SaveChanges; danh mục có sản phẩm không được xóa.
9. Thay/xóa ảnh sau khi mở đấu giá: chặn trước giờ mở và khi đã có bid; kiểm lại sau upload dài.
10. Xóa ảnh chính để lại URL chết: chọn ảnh còn lại và cập nhật product trong cùng lần lưu; chỉ xóa file CDN sau khi DB chấp nhận.
11. Upload CDN thành công nhưng DB lỗi để lại file: dọn file và ghi log nếu CDN dọn thất bại.
12. Phản hồi tải ảnh dùng MIME gốc dù CDN có thể đổi định dạng: dùng Content-Type thực từ CDN.
13. Request tải dữ liệu cũ có thể ghi đè request mới: hook `useRemote` bỏ phản hồi không còn hiện hành.
14. Lịch sử bid hiện 'chưa có' khi đang tải/lỗi: trạng thái tải và lỗi được phân biệt.
15. Sửa sản phẩm seed có URL ảnh nội bộ bị validation chặn: cho giữ URL cũ; URL mới vẫn kiểm HTTP/HTTPS.
16. Ngày giờ trả từ SQL thiếu Z nhưng phản hồi mới ghi có Z: chuẩn hóa JSON thời gian UTC.
17. JWT SignalR xuất hiện trong query log: không ghi query string. Đổi thứ tự middleware để log đúng status cuối cùng, không ghi nhầm 200 khi handler ném lỗi.
18. Thiếu mã lỗi ổn định trong JSON: thêm `code`; UI thoát phiên khi tài khoản bị khóa.
19. Username có thể trùng không gian định danh email hoặc quá ngắn sau trim: quy tắc username 3–50 ký tự; giới hạn độ dài password ở DTO.
20. Lưu hồ sơ đánh dấu toàn bộ User là Modified, có thể ghi đè khóa đồng thời: chỉ lưu các trường profile thực sự đổi.
21. Endpoint cố ý gây lỗi mở công khai cả ngoài Development: giới hạn Admin và Development.
22. Phiên đã quá giờ có thể bị Admin hủy trước lúc worker chốt: không cho hủy sau deadline; thông báo hủy gửi người bán và người đã đặt giá.
23. Trang yêu thích nuốt mọi lỗi API như sản phẩm không tồn tại: chỉ bỏ 404, hiển thị lỗi kết nối.
24. Đăng nhập mất trang đang thao tác: hỗ trợ returnTo nội bộ; đường dẫn lạ hiện trang không tìm thấy.
25. Liên hệ có nút gửi không làm gì: POST `/api/support` lưu thông báo cho Admin đang hoạt động; xác thực thành viên, giới hạn nội dung và tần suất. Bỏ hotline/email mẫu khỏi UI.
26. Dependency PKCS có advisory: pin bản vá 9.0.21; build/test không còn cảnh báo NU1902/NU1903 của gói này.

## Giao diện

- Bỏ import bốn stylesheet cũ khỏi bản chạy. `ui.css` phụ trách bố cục/component, `market.css` phụ trách theme và marketplace.
- Thống nhất form, bảng, trang chi tiết, bộ lọc, tài khoản, nội dung và quản trị ở cả hai theme.
- Trang chủ dùng sản phẩm/giá/thời gian thật thay khẩu hiệu quảng cáo lớn.
- Thư viện ảnh chọn được ảnh chính; action upload/delete đúng trạng thái phiên.
- Sửa min-width của menu quản trị: bảng/menu cuộn trong vùng riêng trên mobile, không kéo tràn cả trang.
- Ảnh SVG dùng chung không còn được hiển thị như ảnh thật của sản phẩm; thay bằng trạng thái chưa có ảnh. Ảnh model tải về có chú thích tham khảo ở trang chi tiết.

## Phạm vi chưa được chứng minh hoàn tất thương mại

- 12/16 sản phẩm có ảnh tham khảo model; 4 sản phẩm còn thiếu ảnh được xác minh. Chưa có bộ ảnh/tình trạng hàng thực tế.
- Thanh toán vẫn xác nhận thủ công; chưa có payment gateway/webhook, hoàn tiền, escrow, tính phí vận chuyển hay theo dõi giao nhận.
- Chưa có xác minh danh tính/người bán, kiểm duyệt hàng hóa, quy trình giải quyết tranh chấp đầy đủ.
- Support đã nhận và lưu yêu cầu vào thông báo Admin; chưa có hội thoại ticket, SLA hoặc email tự động.
- Yêu thích vẫn lưu trên trình duyệt, chưa đồng bộ tài khoản giữa thiết bị.
- Chưa chạy tải lớn, nhiều API instance/worker, kiểm thử vận hành dài hạn, hoặc kiểm chứng chuỗi Cloudinary thật (upload/delete/cleanup khi CDN lỗi). Unit test chỉ xác nhận chặn sửa ảnh sau mở phiên.
- Chưa kiểm chứng màu/tương phản bằng bộ đo accessibility tự động hoặc toàn bộ trình đọc màn hình. Kiểm tra UI tự động đạt không đồng nghĩa thẩm mỹ đã được người dùng duyệt.

Kết quả trên là phạm vi đã kiểm chứng, không phải chứng nhận “không còn lỗi 100%”.
