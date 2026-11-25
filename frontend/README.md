# BidNet React Frontend

Ứng dụng React/Vite cho API BidNet. Chạy backend theo README ở thư mục gốc, rồi tại `frontend`:

```powershell
npm install
npm run dev
```

Mở `http://localhost:3000`. API mặc định là `http://localhost:5014` (Swagger: `http://localhost:5014/swagger/index.html`). Nếu backend đổi cổng, đặt `VITE_API_BASE_URL` trong `.env.local`. Backend CORS phải có `FrontendUrl=http://localhost:3000`. Chạy bằng Vite, không mở trực tiếp `index.html` bằng `file://`.

Token được giữ trong `sessionStorage` của tab và xóa khi đăng xuất. Role trên giao diện chỉ điều khiển hiển thị; backend vẫn là nơi quyết định quyền truy cập. Trang “Kiểm tra API” dùng các endpoint `/api/Errors/*` chỉ dành cho môi trường phát triển.
