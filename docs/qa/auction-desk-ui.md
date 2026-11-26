# Auction Desk — kiểm tra giao diện

## Thay đổi
- Design system nền trung tính/xanh ngọc cho sáng và tối, dùng chung trên marketplace, nội dung, tài khoản và quản trị.
- Admin có header, sidebar và không gian thao tác riêng; dashboard dùng số liệu API và phiên sắp kết thúc thực tế.
- Hoàn thiện màn hình tài khoản, phiên, danh mục, tra cứu đơn, thông báo/hỗ trợ và diagnostics; xử lý alias `/admin/products`, query string và trang quản trị không tồn tại.
- Modal thêm/sửa danh mục, hủy phiên và xác nhận thao tác; khóa nút khi đang xử lý, Escape và trả focus về nút mở.
- Điều hướng tài khoản; sửa phản hồi lỗi/tải lại, trạng thái lưu hồ sơ và đánh dấu thông báo.

## Kiểm chứng
- Build Vite đạt. Dự án dùng JavaScript/JSX, không có TypeScript hoặc script typecheck.
- `py Tests/audit-ui.py`: **378/378** tổ hợp route/vai trò/theme/viewport đạt, gồm 390, 768, 1440 px.
- Danh sách route nội dung được lấy từ các slug trong `content.js`; kiểm tra alias, query và đường dẫn không tồn tại.
- Kiểm tra lỗi JavaScript, HTTP, tràn trang, ảnh đã tải, quyền đặt giá/đăng bán, mở/sửa/đóng modal danh mục và khôi phục focus.
- Kiểm thử bàn phím phát hiện focus ban đầu không vào ô tên danh mục; đã sửa trong `UI.jsx` và chạy lại đạt.
- `py Tests/audit-ui-states.py`: 6/6 tổ hợp viewport/theme đạt với dữ liệu giả lập độc lập: danh mục rỗng, lưu modal thành công, lỗi API và thử lại. Không ghi vào database.
- Đã xem screenshot quản trị desktop/mobile sáng/tối. Bảng rộng cuộn trong vùng bảng trên mobile.

Các lượt kiểm tra trên không phải chứng nhận mọi tương tác và mọi trạng thái đều đã được tự động hóa. Thanh toán, vận chuyển, ảnh hàng thực tế và các giới hạn thương mại vẫn theo báo cáo workflow audit.
