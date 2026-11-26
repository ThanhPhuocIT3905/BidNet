// Nội dung biên tập cho các trang thông tin của Auctora.
// Đây là nội dung gốc của đồ án, không sao chép văn bản từ website tham khảo.
export const news = [
  {
    slug: "khai-mac-mua-dau-gia-cuoi-nam",
    category: "Tin tức",
    title: "Khai mạc mùa đấu giá cuối năm 2026",
    excerpt:
      "Auctora mở mùa đấu giá cuối năm với nhóm sản phẩm công nghệ, đồng hồ và đồ sưu tầm đã được người bán xác thực.",
    date: "2026-11-20",
    read: 5,
    body: [
      ["p", "Mùa đấu giá cuối năm 2026 trên Auctora chính thức bắt đầu. Các phiên được chia theo danh mục để người mua dễ theo dõi: đồ điện tử và công nghệ, đồng hồ và trang sức, nghệ thuật và đồ cổ, xe cộ và phụ tùng."],
      ["h", "Điểm mới trong mùa này"],
      ["p", "Mỗi phiên hiển thị rõ giá khởi điểm, bước giá tối thiểu theo cấu hình hệ thống và thời điểm kết thúc. Người tham gia có thể theo dõi đồng hồ đếm ngược ngay trên thẻ sản phẩm và nhận thông báo khi bị vượt giá."],
      ["p", "Ban quản trị chỉ hủy phiên khi có lý do được ghi lại trong hệ thống. Khi phiên kết thúc, người thắng nhận thông báo và đơn hàng ở trạng thái chờ xử lý."],
      ["h", "Lưu ý khi tham gia"],
      ["p", "Người bán không được tự đặt giá cho sản phẩm của mình. Người mua cần kiểm tra kỹ mô tả, ảnh và thời gian kết thúc trước khi đặt giá. Mọi lượt giá đều được lưu lịch sử để đối chiếu."],
    ],
  },
  {
    slug: "cach-doc-trang-san-pham-dau-gia",
    category: "Hướng dẫn",
    title: "Cách đọc trang sản phẩm đấu giá",
    excerpt:
      "Giá hiện tại, giá khởi điểm, thời gian còn lại và lịch sử đặt giá là bốn thông tin cần xem trước khi ra giá.",
    date: "2026-11-18",
    read: 4,
    body: [
      ["p", "Một trang sản phẩm trên Auctora gồm ảnh, mô tả, thông tin người bán và khối đặt giá. Hiểu đúng từng vùng giúp bạn tránh trả giá cao hơn dự kiến."],
      ["h", "Bốn thông tin quan trọng"],
      ["p", "Thứ nhất là giá hiện tại – mức giá thấp nhất mà lượt đặt tiếp theo phải vượt qua. Thứ hai là giá khởi điểm, dùng để so sánh mức tăng của phiên."],
      ["p", "Thứ ba là thời gian còn lại. Đồng hồ đếm ngược chạy theo giờ máy người dùng nhưng dữ liệu gốc là UTC từ máy chủ. Thứ tư là lịch sử đặt giá, nơi hiển thị số tiền và thời điểm của từng lượt."],
      ["h", "Khi nào nên tải lại trang"],
      ["p", "Hệ thống tự cập nhật qua SignalR khi có lượt giá mới. Nếu kết nối realtime bị gián đoạn, trang vẫn tự tải lại định kỳ. Khi nhận lỗi 409, hãy tải lại để lấy giá mới nhất rồi đặt lại."],
    ],
  },
  {
    slug: "chien-luoc-dat-gia-hop-ly",
    category: "Xu hướng",
    title: "Chiến lược đặt giá hợp lý cho người mới",
    excerpt:
      "Đặt ngân sách trước, theo dõi các phiên sắp kết thúc và không để cảm xúc quyết định bước giá.",
    date: "2026-11-15",
    read: 6,
    body: [
      ["p", "Đấu giá trực tuyến không chỉ là trả giá cao nhất. Người mua hiệu quả thường chuẩn bị ngân sách và giới hạn của mình trước khi phiên bắt đầu."],
      ["h", "Ba nguyên tắc cơ bản"],
      ["p", "Một, xác định giá trị tối đa bạn sẵn sàng trả cho sản phẩm, bao gồm cả chi phí vận chuyển. Hai, không đặt giá chỉ để giữ vị trí dẫn đầu nếu mức giá đã vượt giới hạn."],
      ["p", "Ba, ưu tiên các phiên có mô tả rõ ràng và người bán có lịch sử hoạt động. Trên Auctora, lịch sử đặt giá công khai giúp bạn thấy mức tăng thực tế của từng phiên."],
      ["h", "Theo dõi thay vì vội vàng"],
      ["p", "Chức năng yêu thích giúp lưu phiên quan tâm. Bạn có thể quay lại trước giờ kết thúc để quyết định thay vì theo dõi liên tục."],
    ],
  },
  {
    slug: "bao-mat-tai-khoan-khi-dau-gia",
    category: "Tin tức",
    title: "Bảo mật tài khoản khi tham gia đấu giá",
    excerpt:
      "Không chia sẻ token đăng nhập, kiểm tra địa chỉ trang và đăng xuất trên thiết bị dùng chung.",
    date: "2026-11-12",
    read: 4,
    body: [
      ["p", "Tài khoản Auctora chứa lịch sử đặt giá và thông tin đơn hàng. Bảo vệ tài khoản là trách nhiệm của cả người dùng và hệ thống."],
      ["h", "Thói quen nên duy trì"],
      ["p", "Dùng mật khẩu riêng cho Auctora, không dùng lại mật khẩu email. Đăng xuất khi dùng máy tính công cộng. Không gửi mã token hoặc ảnh chụp màn hình có token cho người khác."],
      ["h", "Phía hệ thống"],
      ["p", "Mật khẩu được lưu dưới dạng PBKDF2 với salt riêng cho từng tài khoản. API giới hạn số lần đăng nhập và đặt giá để giảm nguy cơ dò mật khẩu hoặc spam."],
    ],
  },
  {
    slug: "nguoi-ban-can-chuan-bi-gi",
    category: "Hướng dẫn",
    title: "Người bán cần chuẩn bị gì trước khi mở phiên?",
    excerpt:
      "Ảnh rõ ràng, mô tả trung thực, giá khởi điểm hợp lý và thời gian kết thúc phù hợp là bốn yếu tố quyết định.",
    date: "2026-11-08",
    read: 5,
    body: [
      ["p", "Một phiên đấu giá tốt bắt đầu từ thông tin rõ ràng. Người mua không thể kiểm tra sản phẩm trực tiếp, nên ảnh và mô tả là căn cứ chính."],
      ["h", "Chuẩn bị trước khi đăng"],
      ["p", "Chụp ảnh ở nơi đủ sáng, gồm toàn bộ sản phẩm và các chi tiết hư hỏng nếu có. Mô tả tình trạng, phụ kiện đi kèm và cách giao hàng."],
      ["p", "Chọn giá khởi điểm đủ hấp dẫn nhưng không thấp hơn mức bạn chấp nhận bán. Đặt thời gian kết thúc vào khung giờ người mua thường online."],
      ["h", "Trong và sau phiên"],
      ["p", "Bạn không thể tự đặt giá cho sản phẩm của mình. Khi phiên kết thúc và có người thắng, đơn hàng được tạo ở trạng thái chờ xử lý để hai bên xác nhận."],
    ],
  },
  {
    slug: "xu-huong-dau-gia-do-cong-nghe",
    category: "Xu hướng",
    title: "Xu hướng đấu giá đồ công nghệ đã qua sử dụng",
    excerpt:
      "Laptop và điện thoại cũ vẫn là nhóm sản phẩm có nhiều lượt theo dõi nhờ mức giá dễ tiếp cận.",
    date: "2026-11-03",
    read: 5,
    body: [
      ["p", "Đồ công nghệ đã qua sử dụng chiếm tỷ trọng lớn trong các phiên đấu giá trực tuyến. Người mua quan tâm đến tình trạng pin, bảo hành còn lại và khả năng kiểm tra máy."],
      ["h", "Điều người mua quan tâm"],
      ["p", "Mô tả cần nêu rõ cấu hình, thời gian sử dụng, tình trạng màn hình và pin. Ảnh chụp tem bảo hành hoặc số serial giúp tăng độ tin cậy."],
      ["p", "Với người bán, một phiên có nhiều ảnh thật thường nhận được nhiều lượt đặt giá hơn. Giá khởi điểm quá cao làm giảm số người tham gia ngay từ đầu."],
    ],
  },
];

export const guides = [
  {
    slug: "mo-tai-khoan",
    title: "Mở tài khoản và xác thực",
    excerpt: "Tạo tài khoản, đăng nhập và cập nhật hồ sơ cá nhân trên Auctora.",
    body: [
      ["h", "Bước 1. Đăng ký"],
      ["p", "Mở trang Đăng ký, nhập tên đăng nhập, email và mật khẩu tối thiểu 8 ký tự. Hệ thống kiểm tra trùng username/email trước khi tạo tài khoản."],
      ["h", "Bước 2. Đăng nhập"],
      ["p", "Dùng tên đăng nhập hoặc email để đăng nhập. Sau khi thành công, trình duyệt lưu token trong sessionStorage của tab hiện tại."],
      ["h", "Bước 3. Cập nhật hồ sơ"],
      ["p", "Vào Tài khoản để bổ sung họ tên và số điện thoại. Email và vai trò do hệ thống quản lý, người dùng không tự đổi được."],
    ],
  },
  {
    slug: "tao-phien-dau-gia",
    title: "Tạo phiên đấu giá",
    excerpt: "Chuẩn bị thông tin, chọn danh mục và đặt lịch cho phiên đấu giá.",
    body: [
      ["h", "Bước 1. Chuẩn bị sản phẩm"],
      ["p", "Chụp ảnh, viết mô tả và xác định giá khởi điểm. Giá phải là số nguyên VND, tối thiểu 1.000 đồng."],
      ["h", "Bước 2. Điền biểu mẫu"],
      ["p", "Vào Sản phẩm của tôi → Đăng sản phẩm. Chọn danh mục, nhập giá khởi điểm, thời gian bắt đầu và kết thúc theo giờ địa phương."],
      ["h", "Bước 3. Chờ phiên mở"],
      ["p", "Phiên mới ở trạng thái Sắp diễn ra. Khi tới giờ bắt đầu, worker tự chuyển sang Đang diễn ra. Chỉ sửa được phiên chưa bắt đầu và chưa có lượt giá."],
    ],
  },
  {
    slug: "tham-gia-dau-gia",
    title: "Tham gia đấu giá",
    excerpt: "Cách đặt giá hợp lệ và xử lý khi giá đã thay đổi.",
    body: [
      ["h", "Điều kiện đặt giá"],
      ["p", "Bạn phải đăng nhập, tài khoản còn hoạt động và không phải người bán sản phẩm. Phiên phải đang diễn ra."],
      ["h", "Quy tắc giá"],
      ["p", "Lượt đầu tiên phải từ giá khởi điểm trở lên. Các lượt sau phải cao hơn giá hiện tại ít nhất một bước giá được hiển thị trên trang chi tiết. Giá phải là số nguyên VND. Admin và người bán không được đặt giá cho phiên."],
      ["h", "Khi nhận lỗi 409"],
      ["p", "Giá đã bị người khác thay đổi hoặc phiên vừa đóng. Tải lại trang để lấy giá mới nhất rồi quyết định đặt lại."],
    ],
  },
  {
    slug: "theo-doi-don-hang",
    title: "Theo dõi đơn hàng",
    excerpt: "Xem đơn mua, đơn bán và cập nhật địa chỉ giao hàng.",
    body: [
      ["h", "Đơn hàng được tạo khi nào"],
      ["p", "Khi phiên kết thúc và có người thắng, hệ thống tạo một đơn hàng ở trạng thái Chờ xử lý. Phiên không có lượt giá sẽ không tạo đơn."],
      ["h", "Vai trò trong đơn"],
      ["p", "Người mua cập nhật địa chỉ trước khi đơn được giao. Người bán hoặc quản trị viên xác nhận thủ công: Chờ xử lý → Đã thanh toán → Đã giao. Chỉ được hủy đơn ở trạng thái Chờ xử lý; đơn đã thanh toán cần quy trình hoàn tiền riêng, hiện chưa được tích hợp."],
      ["h", "Thông báo"],
      ["p", "Khi bạn thắng phiên hoặc khi giá của bạn bị vượt, hệ thống ghi thông báo vào tài khoản. Trang Thông báo cho phép đánh dấu đã đọc."],
    ],
  },
  {
    slug: "quy-tac-dau-gia",
    title: "Quy tắc đấu giá và xử lý tranh chấp",
    excerpt: "Các trường hợp bị từ chối và cách liên hệ khi có vấn đề.",
    body: [
      ["h", "Lượt giá không hợp lệ"],
      ["p", "Hệ thống từ chối lượt giá thấp hơn mức tối thiểu, lượt giá của người bán, lượt giá khi tài khoản bị khóa hoặc phiên đã kết thúc."],
      ["h", "Đồng thời"],
      ["p", "Hai người đặt giá cùng lúc có thể dẫn tới xung đột phiên bản dữ liệu. Chỉ một lượt được ghi; lượt còn lại nhận lỗi 409 và phải tải lại giá."],
      ["h", "Khiếu nại"],
      ["p", "Gửi thông tin phiên, thời điểm và ảnh chụp màn hình tới bộ phận hỗ trợ. Quản trị viên có thể hủy phiên nếu phát hiện vi phạm và ghi lý do công khai."],
    ],
  },
];

export const policies = [
  {
    slug: "dieu-khoan-su-dung",
    title: "Điều khoản sử dụng",
    body: [
      ["p", "Khi sử dụng Auctora, bạn đồng ý cung cấp thông tin chính xác, không tạo nhiều tài khoản để thao túng giá và tuân thủ quy định pháp luật về giao dịch."],
      ["h", "Tài khoản"],
      ["p", "Người dùng chịu trách nhiệm bảo mật thông tin đăng nhập. Tài khoản có thể bị khóa nếu có dấu hiệu gian lận hoặc vi phạm quy tắc đấu giá."],
      ["h", "Nội dung đăng bán"],
      ["p", "Người bán phải mô tả đúng tình trạng sản phẩm và có quyền bán tài sản đó. Nghiêm cấm đăng hàng giả, hàng bị cấm hoặc thông tin gây hiểu nhầm."],
    ],
  },
  {
    slug: "quy-dinh-dau-gia",
    title: "Quy định đấu giá",
    body: [
      ["p", "Mỗi phiên có giá khởi điểm, thời gian bắt đầu và kết thúc rõ ràng. Người bán không được tự đặt giá cho sản phẩm của mình."],
      ["h", "Bước giá"],
      ["p", "Bước giá tối thiểu được hiển thị trên từng trang phiên và do máy chủ kiểm tra. Lượt đầu tiên không thấp hơn giá khởi điểm; các lượt sau phải cao hơn giá hiện tại ít nhất một bước giá."],
      ["h", "Kết thúc phiên"],
      ["p", "Người có lượt giá hợp lệ cao nhất tại thời điểm kết thúc là người thắng. Nếu đồng giá, lượt đặt sớm hơn được ưu tiên."],
    ],
  },
  {
    slug: "chinh-sach-bao-mat",
    title: "Chính sách bảo mật",
    body: [
      ["p", "Auctora chỉ thu thập thông tin cần thiết để vận hành tài khoản và giao dịch: tên đăng nhập, email, họ tên, số điện thoại và lịch sử đấu giá."],
      ["h", "Lưu trữ"],
      ["p", "Mật khẩu được băm bằng PBKDF2 và không lưu dạng văn bản. Token đăng nhập có thời hạn và được gửi qua header Authorization."],
      ["h", "Chia sẻ"],
      ["p", "Thông tin cá nhân không được công khai cho người dùng khác. Lịch sử đặt giá công khai chỉ hiển thị số tiền và thời điểm, không hiển thị danh tính."],
    ],
  },
  {
    slug: "phi-dich-vu",
    title: "Phí dịch vụ",
    body: [
      ["p", "Auctora hiện là hệ thống phục vụ đồ án học tập. Các giao dịch trong hệ thống không phát sinh phí thật và không kết nối cổng thanh toán."],
      ["h", "Trạng thái thanh toán"],
      ["p", "Đơn hàng có trạng thái Đã thanh toán khi người bán hoặc quản trị viên xác nhận thủ công. Đây không phải bằng chứng chuyển tiền thực tế."],
      ["h", "Tương lai"],
      ["p", "Nếu tích hợp cổng thanh toán, chính sách phí sẽ được công bố trước khi áp dụng và cần xác minh qua webhook của nhà cung cấp."],
    ],
  },
  {
    slug: "hang-cam",
    title: "Hàng hóa bị cấm",
    body: [
      ["p", "Không được đăng bán hàng giả, hàng nhập lậu, vũ khí, chất cấm, động vật hoang dã hoặc tài sản không có quyền sở hữu hợp pháp."],
      ["h", "Xử lý vi phạm"],
      ["p", "Phiên vi phạm có thể bị hủy bởi quản trị viên. Tài khoản tái phạm có thể bị khóa tạm thời hoặc vĩnh viễn."],
      ["h", "Báo cáo"],
      ["p", "Người dùng có thể gửi báo cáo kèm đường dẫn phiên và mô tả vi phạm tới bộ phận hỗ trợ."],
    ],
  },
  {
    slug: "giai-quyet-tranh-chap",
    title: "Giải quyết tranh chấp",
    body: [
      ["p", "Khi người mua và người bán không thống nhất về tình trạng sản phẩm hoặc giao nhận, hai bên nên lưu lại ảnh, tin nhắn và trạng thái đơn hàng."],
      ["h", "Quy trình"],
      ["p", "Gửi yêu cầu tại trang Liên hệ, kèm mã đơn hàng và nội dung cần hỗ trợ. Theo dõi phản hồi trong mục Yêu cầu hỗ trợ; bạn có thể phản hồi để mở lại yêu cầu đã giải quyết. Hiện biểu mẫu hỗ trợ chưa nhận tệp đính kèm."],
      ["h", "Kết quả"],
      ["p", "Quản trị viên trao đổi hướng xử lý trong yêu cầu hỗ trợ. Hệ thống chỉ cho phép hủy đơn đang chờ thanh toán, có lý do và lịch sử; chưa hỗ trợ hoàn tiền hoặc hủy đơn đã nhận tiền/đã giao. Khóa hoặc mở khóa tài khoản được ghi vào nhật ký quản trị."],
    ],
  },
];

export const about = {
  title: "Về Auctora",
  intro:
    "Auctora là hệ thống sàn đấu giá trực tuyến được xây dựng trong học phần Lập trình Web 2 tại Trường Đại học Đông Á. Đồ án tập trung vào nghiệp vụ đấu giá, tính đúng đắn của giá và khả năng xử lý đồng thời.",
  sections: [
    ["Sứ mệnh", "Tạo một môi trường đấu giá minh bạch, nơi mỗi lượt giá được ghi nhận, người bán không thể tự nâng giá và người mua luôn thấy mức giá thực tế."],
    ["Công nghệ", "Backend ASP.NET Core Web API, Entity Framework Core và SQL Server. Giao diện React/Vite gọi API qua JSON, nhận cập nhật realtime bằng SignalR và hiển thị đồng hồ đếm ngược theo dữ liệu UTC."],
    ["Điểm cốt lõi", "RowVersion bảo vệ giá khỏi ghi đè khi hai người đặt cùng lúc. Worker tự mở và đóng phiên. Đơn hàng chỉ được tạo khi phiên có người thắng và mỗi sản phẩm có tối đa một đơn."],
    ["Phạm vi", "Hệ thống phục vụ mục đích học tập, chưa tích hợp thanh toán thật, vận chuyển hoặc xác minh danh tính bên thứ ba."],
  ],
};

export const contact = {
  hotline: "0236 3 686 251",
  email: "contact@Auctora.local",
  address: "Khoa Công nghệ thông tin, Trường Đại học Đông Á, Đà Nẵng",
  hours: "Thứ Hai – Thứ Sáu, 08:00 – 17:00",
  channels: [
    ["Hỗ trợ tài khoản", "Đăng nhập, đăng ký, khóa tài khoản và cập nhật hồ sơ."],
    ["Hỗ trợ đấu giá", "Lỗi đặt giá, xung đột giá, phiên kết thúc bất thường."],
    ["Hỗ trợ đơn hàng", "Địa chỉ giao hàng, trạng thái thanh toán và giao nhận."],
    ["Báo cáo vi phạm", "Hàng cấm, thông tin sai lệch hoặc hành vi thao túng giá."],
  ],
};
