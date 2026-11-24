"""Generate the BidNet Web 2 defense report. Requires python-docx and Pillow.
Run: py docs/presentation/make-report.py
"""
from pathlib import Path
from datetime import date
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION_START
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).parent
OUT = ROOT / 'BaoCao-BidNet-Web2.docx'
IMAGES = ROOT / 'images'
IMAGES.mkdir(exist_ok=True)
NAVY, BLUE, GREY = (20, 40, 82), (30, 72, 153), (76, 87, 102)
FONT_PATH = r'C:\Windows\Fonts\arial.ttf'
FONT_BOLD = r'C:\Windows\Fonts\arialbd.ttf'

def f(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_PATH, size)

def rounded(d, xy, title, detail, color=(236, 243, 255), width=26):
    d.rounded_rectangle(xy, radius=15, fill=color, outline=BLUE, width=2)
    x1, y1, x2, y2 = xy
    d.text((x1+18, y1+13), title, font=f(25, True), fill=NAVY)
    for i, line in enumerate(detail.split('\n')):
        d.text((x1+18, y1+51+i*27), line, font=f(20), fill=GREY)

def arrow(d, a, b, label=''):
    d.line((a, b), fill=BLUE, width=3)
    if label:
        x = (a[0]+b[0])//2; y = (a[1]+b[1])//2
        d.rounded_rectangle((x-48, y-18, x+48, y+17), 8, fill='white')
        d.text((x-35, y-13), label, font=f(18, True), fill=BLUE)

def picture(name, width, height):
    p = IMAGES / name
    im = Image.new('RGB', (width, height), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, width-1, height-1), outline=(195, 208, 229), width=2)
    return p, im, d

# ERD: precise FK cardinalities and names taken from AppDbContext + migration.
p, im, d = picture('erd-7-tables.png', 1500, 950)
nodes = [
 ('Users','PK Id | UQ Username, Email\nRole, IsActive', (30,65,400,205)),
 ('Categories','PK Id | UQ Name\nDescription', (565,65,935,205)),
 ('Products','PK Id | FK SellerId, WinnerId\nFK CategoryId? | RowVersion', (565,320,935,480)),
 ('Bids','PK Id | FK ProductId\nFK UserId | Amount', (30,630,400,790)),
 ('ProductImages','PK Id | FK ProductId?\nCloudinaryUrl / PublicId', (565,630,935,790)),
 ('Orders','PK Id | UQ FK ProductId\nFK BuyerId, SellerId', (1100,320,1470,480)),
 ('Notifications','PK Id | FK UserId\nIsRead / CreatedAt', (1100,630,1470,790)),
]
for title, detail, rect in nodes: rounded(d, rect, title, detail)
for a,b,label in [((750,205),(750,320),'1:N'),((400,205),(565,335),'1:N'),
                  ((620,480),(350,630),'1:N'),((750,480),(750,630),'1:N'),
                  ((935,400),(1100,400),'1:0..1')]: arrow(d,a,b,label)
d.text((35,820),'Quan hệ với Users: Products.SellerId/WinnerId; Bids.UserId;',font=f(20),fill=GREY)
d.text((35,850),'Orders.BuyerId/SellerId; Notifications.UserId (mỗi FK: Users 1—N).',font=f(20),fill=GREY)
im.save(p)

p, im, d = picture('usecase-7-tables.png', 1500, 850)
for x, title, items in [
 (35,'Khách','Xem danh mục\nXem sản phẩm và lịch sử bid'),
 (510,'Người dùng','Đăng ký/đăng nhập\nTạo phiên (người bán)\nĐặt giá (người mua)\nXem đơn / thông báo'),
 (985,'Quản trị viên','Quản lý danh mục\nKhóa tài khoản\nHủy phiên vi phạm')]:
 rounded(d,(x,120,x+450,420),title,items)
for x, title, items in [
 (185,'Worker','Mở / đóng phiên\nTạo Order + Notifications'),
 (765,'SignalR Hub','BidAccepted\nAuctionClosed')]:
 rounded(d,(x,520,x+450,760),title,items,(239,250,242))
im.save(p)

p, im, d = picture('architecture-7-tables.png', 1500, 590)
for i, (title, detail) in enumerate([
 ('Swagger / Client','HTTP + JWT'),('ASP.NET Core','Controller / Auth'),
 ('Services / Worker','Bid, Product, Close'),('EF Core','7 DbSets / migration'),
 ('SQL Server','BidNetDb')]):
    x=20+i*300; rounded(d,(x,100,x+270,290),title,detail)
    if i<4: arrow(d,(x+272,195),(x+296,195))
rounded(d,(230,370,640,545),'SignalR','Realtime after database commit',(239,250,242))
rounded(d,(860,370,1270,545),'Cloudinary','Ảnh sản phẩm',(239,250,242))
im.save(p)

p, im, d = picture('publish-bidnet.png', 1500, 480)
for i,(title, detail) in enumerate([
 ('Source','dotnet build / test'),('Publish','dotnet publish -c Release'),
 ('Host','IIS + Hosting Bundle'),('Database','SQL Server + migration')]):
 x=25+i*375; rounded(d,(x,125,x+330,330),title,detail)
 if i<3: arrow(d,(x+333,220),(x+370,220))
im.save(p)

p, im, d = picture('class-bidnet.png', 1500, 750)
for x, y, title, detail in [
 (20,80,'User','Id, Username, Role\nListedProducts, Bids'),
 (515,80,'Product','SellerId, WinnerId, CategoryId?\nRowVersion, Status, CurrentPrice'),
 (1010,80,'Category','Id, Name (unique)\nProducts'),
 (20,430,'Bid','ProductId, UserId\nAmount, BidTime'),
 (515,430,'Order','ProductId (unique)\nBuyerId, SellerId, Status'),
 (1010,430,'Notification','UserId, Title\nMessage, IsRead')]:
 rounded(d,(x,y,x+450,y+220),title,detail)
for a,b,label in [((470,175),(515,175),'1:N'),((965,175),(1010,175),'N:1'),
                  ((240,300),(240,430),'1:N'),((735,300),(735,430),'1:0..1')]: arrow(d,a,b,label)
d.text((40,685),'ProductImages: ProductId? → Product (1:N); Order tham chiếu User hai vai Buyer và Seller.',font=f(19),fill=GREY)
im.save(p)

p, im, d = picture('activity-bidnet.png', 1500, 640)
for i,(title,detail) in enumerate([
 ('Người mua','POST /products/{id}/bids'),('BidService','Kiểm tra JWT, status, giờ'),
 ('Quy tắc giá','Lượt đầu ≥ giá gốc\nLượt sau + 1.000 VND'),
 ('EF Core','Bid + CurrentPrice\n+ Notifications'),('SignalR','BidAccepted sau commit')]):
 x=20+i*300; rounded(d,(x,150,x+270,430),title,detail)
 if i<4: arrow(d,(x+272,290),(x+296,290))
d.text((75,520),'Nhánh lỗi: 400 giá sai | 403 seller / tài khoản bị khóa | 409 phiên đóng hoặc RowVersion xung đột.',font=f(21),fill=GREY)
im.save(p)

p, im, d = picture('sequence-bidnet.png', 1500, 710)
actors=[('Client',80),('Controller',365),('BidService',650),('SQL Server',935),('SignalR',1220)]
for name,x in actors:
 d.text((x-30,30),name,font=f(24,True),fill=NAVY)
 d.line((x,85,x,660),fill=(152,169,196),width=2)
for y,x1,x2,text in [
 (125,80,365,'POST bid + JWT'),(195,365,650,'PlaceAsync'),
 (275,650,935,'đọc Product / giá'),(355,650,935,'SaveChanges: Bid + Price + Notification'),
 (440,935,650,'commit hoặc concurrency 409'),(525,650,1220,'BidAccepted sau commit'),
 (600,650,80,'201 / 400 / 403 / 409')]:
 d.line((x1,y,x2,y),fill=BLUE,width=3)
 d.polygon([(x2,y),(x2-13 if x2>x1 else x2+13,y-7),(x2-13 if x2>x1 else x2+13,y+7)],fill=BLUE)
 d.text((min(x1,x2)+10,y-28),text,font=f(18),fill=GREY)
im.save(p)

doc = Document()
sec = doc.sections[0]
sec.top_margin = Cm(2.4); sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(3.0); sec.right_margin = Cm(2.0)
sec.header_distance = Cm(1.2); sec.footer_distance = Cm(1.2)
styles = doc.styles
normal=styles['Normal']; normal.font.name='Times New Roman'; normal.font.size=Pt(12)
normal.paragraph_format.space_after=Pt(6); normal.paragraph_format.line_spacing=1.3
for name,size in [('Title',20),('Heading 1',16),('Heading 2',14),('Heading 3',12)]:
 st=styles[name]; st.font.name='Times New Roman'; st.font.size=Pt(size)
 st.font.bold=True; st.font.color.rgb=RGBColor(*NAVY)
 st.paragraph_format.space_before=Pt(13); st.paragraph_format.space_after=Pt(6)

def para(text='', style=None):
 return doc.add_paragraph(text, style)
def heading(text, level=1):
 return doc.add_heading(text, level)
def tbl(headers, rows):
 t=doc.add_table(rows=1, cols=len(headers)); t.style='Table Grid'; t.alignment=WD_TABLE_ALIGNMENT.CENTER
 for i,h in enumerate(headers):
  c=t.rows[0].cells[i]; c.text=h
  for r in c.paragraphs[0].runs: r.bold=True; r.font.color.rgb=RGBColor(255,255,255)
  shading=OxmlElement('w:shd'); shading.set(qn('w:fill'),'1E4A91'); c._tc.get_or_add_tcPr().append(shading)
 for row in rows:
  cells=t.add_row().cells
  for i,v in enumerate(row): cells[i].text=str(v); cells[i].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
 doc.add_paragraph()
 return t
def figure(filename, caption, w=15.7):
 doc.add_picture(str(IMAGES/filename),width=Cm(w))
 x=para(caption); x.alignment=WD_ALIGN_PARAGRAPH.CENTER; x.runs[0].italic=True
def shot(filename, caption, w=15.7):
 path=ROOT/'screenshots'/filename
 if path.exists():
  if filename == '01-swagger-overview.png':
   # Original is a 980×4025 scrolling page: a full-width Word insertion
   # exceeds one page and produces empty-looking pages. Keep the actual UI
   # pixels, only crop the top portion with auth and product routes.
   cropped=IMAGES/'swagger-overview-crop.png'
   with Image.open(path) as source:
    source.crop((0,0,source.width,min(source.height,1120))).save(cropped)
   path=cropped
  with Image.open(path) as image:
   width=min(w,17.5*image.width/image.height)
  doc.add_picture(str(path),width=Cm(width))
  x=para(caption); x.alignment=WD_ALIGN_PARAGRAPH.CENTER; x.runs[0].italic=True
def page(): doc.add_page_break()
def chapter(n, title):
 return heading(f'CHƯƠNG {n}. {title}',2)
def section(n, title):
 return heading(f'{n}. {title}',3)
def part(title):
 p=heading(title,1)
 p.paragraph_format.page_break_before=True
 return p

# Cover: same academic convention as the reference, entirely new BidNet content.
for text,size in [('TRƯỜNG ĐẠI HỌC ĐÔNG Á',14),('KHOA CÔNG NGHỆ THÔNG TIN',14)]:
 p0=para(); p0.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p0.add_run(text); r.bold=True; r.font.size=Pt(size)
para('\n\n')
for text,size in [('BÁO CÁO KẾT THÚC MÔN',18),('LẬP TRÌNH WEB 2',19),
                  ('HỆ THỐNG SÀN ĐẤU GIÁ TRỰC TUYẾN BIDNET',20)]:
 p0=para(); p0.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p0.add_run(text); r.bold=True; r.font.size=Pt(size); r.font.color.rgb=RGBColor(*NAVY)
para('\n\n')
tbl(['Thông tin','Điền trước khi nộp'],[
 ('Giảng viên hướng dẫn','...........................................'),
 ('Sinh viên thực hiện','...........................................'),
 ('Mã sinh viên / Lớp','...........................................')])
para('\n\n')
p0=para('Đà Nẵng, tháng 11 năm 2026'); p0.alignment=WD_ALIGN_PARAGRAPH.CENTER
page()

heading('LỜI CẢM ƠN',1)
para('Nhóm thực hiện trân trọng cảm ơn giảng viên học phần Lập trình Web 2 và Khoa Công nghệ thông tin, Trường Đại học Đông Á, đã cung cấp kiến thức và yêu cầu thực hành về Web API, tích hợp, kiểm thử và trình bày đồ án. Báo cáo tập trung phản ánh đúng những gì mã nguồn BidNet hiện thực tại thời điểm kiểm tra; các hạn chế được nêu riêng thay vì coi là chức năng đã hoàn thành.')
heading('TÓM TẮT ĐỀ TÀI',1)
para('BidNet là hệ thống đấu giá trực tuyến dạng ASP.NET Core Web API. Dữ liệu gồm 7 bảng ứng dụng và 5 migration; nghiệp vụ chính gồm đăng ký, đăng nhập, đăng bán, đấu giá, đóng phiên tự động, tạo đơn Pending, thông báo và quản trị. Tính đúng đắn của mức giá được hỗ trợ bằng optimistic concurrency RowVersion; SignalR phát sự kiện sau khi lưu dữ liệu. Báo cáo mô tả bài toán, yêu cầu, thiết kế, triển khai và kiểm thử với giới hạn chứng cứ rõ ràng.')
heading('DANH MỤC TỪ VIẾT TẮT',1)
tbl(['Từ viết tắt','Ý nghĩa'],[
 ('API / REST','Giao diện lập trình ứng dụng / quy ước tài nguyên HTTP'),
 ('DTO / DI','Đối tượng trao đổi dữ liệu / tiêm phụ thuộc'),
 ('EF Core / ORM','Entity Framework Core / ánh xạ đối tượng–quan hệ'),
 ('JWT / CORS','JSON Web Token / chính sách truy cập khác origin'),
 ('ERD / UML','Sơ đồ thực thể–quan hệ / ngôn ngữ mô hình hóa'),
 ('FK / PK / UQ','Khóa ngoại / khóa chính / ràng buộc duy nhất')])
heading('DANH MỤC HÌNH VÀ BẢNG CHÍNH',1)
para('Hình chính: Use case, Activity, Kiến trúc, Class, Sequence, ERD, Publish và ảnh Swagger. Bảng chính: yêu cầu, tác nhân, endpoint, dữ liệu và kiểm thử.')
page()

doc.add_paragraph('MỤC LỤC', style='Title')
para('Báo cáo môn Lập trình Web 2 — Hệ thống sàn đấu giá trực tuyến BidNet.')
p0=para()
fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'TOC \\o "1-3" \\h \\z \\u'); p0._p.append(fld)
part('PHẦN I. MỞ ĐẦU')
heading('CHƯƠNG 1. TỔNG QUAN ĐỀ TÀI',2)
section('1.1','Bối cảnh và lý do chọn đề tài')
para('Đấu giá trực tuyến cần bảo đảm người mua có thể đặt giá theo thời gian thực, người bán theo dõi phiên và kết quả được chốt tự động, công bằng. BidNet là đồ án Web API cho môn Lập trình Web 2, phát triển thành hệ thống 7 bảng khép kín từ sản phẩm, đặt giá đến đơn hàng và thông báo.')
section('1.2','Mục tiêu, phạm vi và đối tượng sử dụng')
para('Mục tiêu: triển khai API REST có xác thực JWT, phân quyền Admin/User, vòng đời phiên đấu giá tự động, giá tăng hợp lệ, chống tranh chấp RowVersion, SignalR, danh mục chuẩn hóa, đơn sau thắng và thông báo cá nhân. Đối tượng: khách, người bán, người mua, quản trị viên; worker xử lý định kỳ.')
para('Phạm vi thực hiện: backend ASP.NET Core + SQL Server; frontend không nằm trong repository backend. Đơn hàng có trạng thái Pending/Paid/Delivered/Cancelled nhưng Paid do người bán/Admin cập nhật thủ công, chưa kết nối cổng thanh toán hay giao vận. Không trình bày tính năng chưa có như thanh toán điện tử.')
section('1.3','Yêu cầu và quy tắc nghiệp vụ')
tbl(['Nhóm','Kết quả hiện thực'],[
 ('Chức năng','Đăng ký/đăng nhập; sản phẩm/danh mục; bid; ảnh; đơn; thông báo; quản trị'),
 ('Bảo mật','PBKDF2-SHA256, JWT, [Authorize], vai trò, CORS một origin, rate limiting'),
 ('Đấu giá','Lượt đầu ≥ giá khởi điểm; lượt sau ≥ giá hiện tại + 1.000 VND; seller không tự bid'),
 ('Phi chức năng','Phân trang SQL; worker mỗi 5 giây; RowVersion; log; DTO; lỗi JSON')])
section('1.4','Phương pháp thực hiện và phạm vi xác minh')
para('Nhóm tổ chức công việc theo quy trình rút gọn: xác định tác nhân và quy tắc; mô hình hóa dữ liệu; xây dựng API và migration; ghép JWT, worker, SignalR; viết unit test; kiểm tra build, database và Swagger. Khi đọc báo cáo, cần phân biệt “đã hiện thực trong code”, “đã kiểm thử tự động” và “được đề xuất cho tương lai”. Hai mệnh đề cuối không thể suy ra trực tiếp từ mệnh đề đầu.')
tbl(['Bước','Đầu vào','Đầu ra thực tế trong repository'],[
 ('Phân tích','Quy tắc đấu giá; vai khách/User/Admin','DTO và route chức năng; trạng thái phiên'),
 ('Thiết kế','Sản phẩm, giá, người tham gia','7 entity, Fluent API, migration'),
 ('Xây dựng','ASP.NET Core và SQL Server','Controller, service, worker, hub'),
 ('Kiểm tra','Kịch bản đúng/sai/tranh chấp','xUnit, SQL test tùy biến môi trường; Swagger'),
 ('Tài liệu','Yêu cầu Buổi 13–15','Sơ đồ, bảng endpoint, ảnh demo, báo cáo')])
section('1.5','Cấu trúc báo cáo')
para('Chương 1 đặt bối cảnh; chương 2 trình bày cơ sở công nghệ; chương 3 đặc tả nghiệp vụ; chương 4 phân tích–thiết kế; chương 5 mô tả xây dựng/triển khai; chương 6 kiểm thử và đánh giá; chương 7 tổng kết. Bảy chương được xếp trong năm phần mà học liệu Buổi 15 yêu cầu.')

part('PHẦN II. CƠ SỞ LÝ THUYẾT')
chapter(2,'CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ')
section('2.1','ASP.NET Core Web API và REST')
para('Controller ánh xạ HTTP GET/POST/PUT/PATCH/DELETE sang thao tác tài nguyên, trả status 200/201/204/400/401/403/404/409/429. DTO giúp không lộ mật khẩu/hash hoặc entity EF; [ApiController] hỗ trợ kiểm tra dữ liệu đầu vào.')
para('Các route sử dụng tên tài nguyên số nhiều (/api/products, /api/orders). GET truy vấn, POST tạo, PUT thay toàn bộ thông tin được cho phép, PATCH cập nhật một phần, DELETE xóa danh mục/ảnh theo quyền. Đặt giá POST /api/products/{id}/bids trả 201 cho bản ghi bid mới; lỗi nghiệp vụ được biểu diễn bằng mã HTTP thay vì trả 200 kèm chuỗi báo lỗi.')
section('2.2','SQL Server, EF Core và migration')
para('EF Core quản lý entity, khóa ngoại, unique index và truy vấn; migration quản lý thay đổi schema. SQL Server lưu giá bằng decimal(18,2), Product.RowVersion được dùng cho optimistic concurrency. DbContext dùng scoped qua DI; worker tạo scope riêng.')
para('Ở BidNet, AppDbContext khai báo 7 DbSet; Fluent API tạo ràng buộc khóa và delete behavior. Unique Order.ProductId bảo vệ nguyên tắc tối đa một đơn mỗi sản phẩm ngay tại CSDL. RowVersion trên Products là token do SQL Server cập nhật khi hàng bị sửa: EF Core UPDATE với giá trị RowVersion cũ sẽ thất bại nếu một request khác đã lưu trước.')
section('2.3','JWT, PBKDF2, SignalR và BackgroundService')
para('Mật khẩu được băm PBKDF2-SHA256 với 210.000 vòng và salt 16 byte. JWT ký HMAC-SHA256, hiệu lực 60 phút; [Authorize] kiểm soát API; CurrentUser đọc lại trạng thái tài khoản cho thao tác nhạy cảm. SignalR phát BidAccepted/AuctionClosed sau commit; BackgroundService quét tối đa 50 phiên mỗi lượt, chu kỳ 5 giây.')
para('JWT là thông tin xác thực phía client, không phải cam kết rằng tài khoản luôn còn hoạt động; vì vậy các thao tác nhạy cảm đọc lại trạng thái user trong database. Hub /hubs/auction chỉ nhận access_token qua query cho đường dẫn hub, còn REST dùng Authorization: Bearer. Worker là singleton nên không giữ DbContext scoped xuyên nhiều chu kỳ quét.')
section('2.4','Swagger/OpenAPI, CORS và publish')
para('Trong Development, /swagger dùng tài liệu /openapi/v1.json có Bearer security scheme, phục vụ test [Authorize]. CORS FrontendOnly giới hạn đúng một FrontendUrl, middleware đặt sau UseRouting và trước UseAuthorization. Release publish bằng dotnet publish -c Release -o ./publish; IIS cần .NET Hosting Bundle và cấu hình connection string/JWT/Cloudinary bằng secrets hoặc biến môi trường.')
section('2.5','Các thành phần hỗ trợ thực tế')
tbl(['Công nghệ','Vị trí dùng trong BidNet','Lưu ý'],[
 ('ASP.NET Core 10','API pipeline, Controller, DI','Framework chạy ứng dụng'),
 ('EF Core / SQL Server','Migration, truy vấn, RowVersion','Nguồn dữ liệu chính'),
 ('SignalR','AuctionHub; BidAccepted/AuctionClosed','Không thay thế truy vấn DB'),
 ('CloudinaryDotNet','Lưu ảnh sản phẩm bên ngoài SQL','DB giữ metadata/URL'),
 ('Swagger UI / OpenAPI','Tài liệu và thử API trong Development','Không mở tự do trong production'),
 ('xUnit / Moq / InMemory','Unit test, giả lập hub; test SQL tùy chọn','InMemory không chứng minh ràng buộc SQL'),
 ('Serilog','Ghi nhận request và lỗi','Không ghi token/secret vào báo cáo')])
para('Không sử dụng các công nghệ như Redis, RabbitMQ, cổng thanh toán, Docker hoặc frontend React trong phạm vi repository hiện tại; không đưa chúng vào danh sách công nghệ đã triển khai.')

part('PHẦN III. PHÂN TÍCH VÀ THIẾT KẾ')
chapter(3,'PHÂN TÍCH VÀ ĐẶC TẢ NGHIỆP VỤ')
section('3.1','Khảo sát bài toán và tác nhân')
para('Không có nền tảng đặt giá, một lời rao bán chỉ thể hiện giá mong muốn mà không kiểm soát giá tăng, thời gian kết thúc hay người thắng. BidNet tổ chức mỗi sản phẩm thành một phiên với StartTime/EndTime UTC; một lượt đặt giá là bản ghi độc lập để truy vết. Cả khách và tài khoản đều xem sản phẩm; người tham gia đặt giá phải đăng nhập. “Người bán” và “người mua” là vai trò theo giao dịch, không phải hai role riêng trong JWT (role là User hoặc Admin).')
tbl(['Tác nhân','Quyền hoặc trách nhiệm','Hạn chế quan trọng'],[
 ('Khách','Xem danh mục, sản phẩm và lịch sử bid công khai','Không đặt giá; lịch sử ẩn UserId'),
 ('Người bán (User)','Tạo/sửa sản phẩm trước giờ; xem đơn bán','Không tự bid sản phẩm của mình'),
 ('Người mua (User)','Đặt giá, xem đơn mua, cập nhật địa chỉ','Chỉ xem đơn liên quan đến mình'),
 ('Admin','Khóa tài khoản, hủy phiên, quản lý danh mục','Không tự khóa tài khoản hiện dùng'),
 ('Worker','Chuyển trạng thái và chốt Order/Notification','Không có quyền thanh toán thực tế')])
section('3.2','Yêu cầu chức năng và phi chức năng')
tbl(['Mã','Yêu cầu chức năng','Hiện thực trong code'],[
 ('F01','Đăng ký, đăng nhập, truy vấn hồ sơ','AuthController / UserController'),
 ('F02','Tạo và sửa phiên do mình đăng','ProductController / ProductService'),
 ('F03','Xem, tìm kiếm và phân trang sản phẩm','GET /api/products; PageArgs'),
 ('F04','Đặt giá, xem lịch sử và chặn bid sai','BidService, Bids'),
 ('F05','Tự động mở, kết thúc và chốt thắng','AuctionClosingService'),
 ('F06','Danh mục chuẩn hóa; Admin CRUD','CategoriesController'),
 ('F07','Tạo và theo dõi đơn Pending, giao nhận thủ công','OrdersController / worker'),
 ('F08','Thông báo outbid, người bán, thắng phiên','BidService / worker / NotificationsController'),
 ('F09','Cập nhật realtime và quản trị','AuctionHub / AdminController')])
tbl(['Mã','Yêu cầu phi chức năng','Cách kiểm tra phù hợp'],[
 ('N01','Không ghi đè giá khi bid đồng thời','Test RowVersion trên SQL Server'),
 ('N02','Không lộ hash mật khẩu hoặc UserId của lịch sử công khai','Kiểm tra DTO/Swagger'),
 ('N03','Chống spam xác thực, đặt giá','10/phút/IP, 30/phút/user; HTTP 429'),
 ('N04','Truy vấn lớn có phân trang','Product/Bids/Users; chưa có phân trang Orders/Notifications'),
 ('N05','Giữ bí mật deployment','User Secrets/biến môi trường; không commit secret')])
section('3.3','Sơ đồ use case và điều kiện chung')
figure('usecase-7-tables.png','Hình 3.1. Tổng hợp tác nhân và chức năng đã hiện thực.')
para('Tiền điều kiện đặt giá: tài khoản còn hoạt động; sản phẩm tồn tại và Active trong khoảng [StartTime, EndTime); bidder không phải SellerId. Hậu điều kiện thành công: xuất hiện một Bid, CurrentPrice được cập nhật, thông báo được ghi, sự kiện realtime được gửi sau commit. Điều kiện lỗi: không được tạo Bid hoặc cập nhật giá.')
section('3.4','Đặc tả use case điển hình')
tbl(['Use case','Tác nhân / tiền điều kiện','Luồng chính và ngoại lệ'],[
 ('UC01 Đăng ký/đăng nhập','Khách; username/email hợp lệ','Tạo User role User, băm PBKDF2; login trả JWT; trùng tài khoản 409, sai mật khẩu 401'),
 ('UC02 Đăng sản phẩm','User đang hoạt động','Kiểm tra tên, giá nguyên VND ≥1.000, thời gian UTC trong tương lai; Scheduled, SellerId từ JWT; CategoryId phải tồn tại'),
 ('UC03 Đặt giá','Buyer; Active, còn giờ','Bid đầu ≥ StartingPrice, lượt sau ≥ CurrentPrice + 1.000; seller 403, sai giá 400, xung đột 409'),
 ('UC04 Đóng phiên','Worker; EndTime đã qua','Chọn giá cao nhất, đồng giá ưu tiên sớm; nếu có bid: Completed + Order Pending + hai Notification; không bid: không tạo Order'),
 ('UC05 Xử lý đơn','Buyer/Seller/Admin liên quan','Buyer cập nhật địa chỉ; Seller/Admin đổi Pending→Paid/Cancelled, Paid→Delivered/Cancelled; lỗi quyền 403'),
 ('UC06 Quản trị','Admin còn hoạt động','CRUD Categories, khóa User, hủy phiên; User thường bị 403')])
section('3.5','Quy trình từ đăng nhập đến chốt đơn')
para('Đăng nhập: kiểm tra thông tin → phát JWT → client gắn Authorization header khi gọi route protected. Tạo sản phẩm: người bán gửi giá và lịch UTC → tạo Scheduled; worker mở Active khi tới StartTime. Trong phiên: Buyer gọi POST bid; service xét thời gian, giá và quyền rồi lưu; nếu có người đang dẫn đầu khác, thông báo outbid được ghi. Hết phiên: worker truy vấn bid thắng, chốt Completed; Order chỉ xuất hiện khi có bid và mang giá của bid thắng.')
figure('activity-bidnet.png','Hình 3.2. Activity luồng đặt giá và các nhánh lỗi chính.')
section('3.6','Quy tắc đơn hàng và thông báo')
tbl(['Đối tượng','Sự kiện','Dữ liệu / người nhận'],[
 ('Orders','Phiên Completed có winner','ProductId duy nhất; BuyerId, SellerId, FinalPrice; Pending'),
 ('Notifications','Bid mới','Seller nhận thông báo có giá mới'),
 ('Notifications','Người đang dẫn đầu bị vượt','Chỉ bidder đứng đầu trước lượt mới nhận outbid'),
 ('Notifications','Chốt phiên thành công','Buyer và Seller nhận hai thông báo'),
 ('SignalR','Sau khi dữ liệu lưu thành công','BidAccepted hoặc AuctionClosed cho nhóm auction:{id}')])
para('Đơn không có bảng giao dịch thanh toán. Việc đổi trạng thái Paid là thao tác thủ công được phân quyền, không xác nhận tiền thực chuyển. Thông báo trong DB có trạng thái IsRead; SignalR là đường phát realtime độc lập, không phải chứng cứ người dùng đã đọc thông báo.')

chapter(4,'PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG')
section('4.1','Kiến trúc tổng thể')
figure('architecture-7-tables.png','Hình 4.1. Kiến trúc BidNet (Categories/Orders/Notifications dùng DbContext trực tiếp ở Controller).')
para('Luồng bid, sản phẩm và xác thực được tách Service/Repository; ba Controller mới thao tác DbContext trực tiếp. Đây là cấu trúc thực tế của code, không nhận vơ toàn bộ logic ở Service. Ảnh sản phẩm được lưu Cloudinary.')
section('4.2','Sơ đồ lớp và các quan hệ quan trọng')
figure('class-bidnet.png','Hình 4.2. Sơ đồ lớp rút gọn từ entity và quan hệ đang dùng.')
para('Sơ đồ lớp chỉ thể hiện thuộc tính và liên kết quan trọng; phần thiết kế dữ liệu ở mục 4.4 liệt kê đầy đủ các bảng. User đóng nhiều vai: SellerId/WinnerId ở Product, UserId ở Bid/Notification và BuyerId/SellerId ở Order. CategoryRef trong Product là nullable để dữ liệu cũ vẫn đọc được.')
section('4.3','Sơ đồ tuần tự đặt giá và vòng đời phiên')
figure('sequence-bidnet.png','Hình 4.3. Trình tự BidService kiểm tra, lưu và phát sự kiện.')
para('Luồng chính: người bán tạo phiên Scheduled → worker chuyển Active → người mua đặt giá → hệ thống ghi Bid/CurrentPrice/Notification trong một SaveChanges → SignalR phát BidAccepted → worker đóng Completed, xác định người thắng → tạo Order Pending và thông báo cho buyer/seller. Nếu không có bid thì không tạo Order.')
para('SaveChanges của BidService bao gồm Bid, CurrentPrice và Notification. EF Core sử dụng transaction khi cần nhiều câu lệnh; RowVersion ngăn request dùng phiên bản giá cũ ghi đè. Nếu HTTP response trả lỗi do SignalR sau khi commit, client có thể bid lại gây lặp; vì vậy lỗi phát hub chỉ được log, không phủ định lần ghi đã thành công. Worker gửi AuctionClosed sau khi lưu phiên.')
section('4.4','Thiết kế dữ liệu và ERD')
figure('erd-7-tables.png','Hình 4.4. ERD bảy bảng ứng dụng và các khóa ngoại chính.')
tbl(['Bảng','Vai trò','Quan hệ/ràng buộc'],[
 ('Users','Tài khoản, role','Username/Email duy nhất; 1-N sản phẩm/bid/thông báo'),
 ('Categories','Danh mục','Name duy nhất; 1-N Products, CategoryId nullable'),
 ('Products','Sản phẩm/phiên','SellerId, WinnerId, CategoryId; RowVersion'),
 ('ProductImages','Ảnh sản phẩm','ProductId? → Products: N-1, nullable / SetNull'),
 ('Bids','Lịch sử giá','ProductId → Products; UserId → Users'),
 ('Orders','Kết quả thắng','ProductId duy nhất (1-0..1), BuyerId/SellerId → Users'),
 ('Notifications','Thông báo cá nhân','UserId → Users; IsRead')])
para('Migration mới 20261124030551_AddCategoriesOrdersNotifications bổ sung 3 bảng và CategoryId. Tổng cộng 5 migration trong source, 7 bảng ứng dụng trong BidNetDb (không tính bảng lịch sử migration và sysdiagrams).')
section('4.5','Danh sách endpoint và quyền')
tbl(['Nhóm','Phương thức và đường dẫn','Quyền'],[
 ('Auth','POST /api/auth/register; POST /api/auth/login','Công khai'),
 ('Products','GET /api/products; GET /api/products/{id}','Công khai'),
 ('Products','GET /api/products/me; POST /api/products; PUT /api/products/{id}','JWT / chủ sở hữu'),
 ('Bids','POST /api/products/{id}/bids; GET /api/products/{id}/bids','JWT / công khai'),
 ('Images','POST/GET /api/products/{id}/images; GET/DELETE /api/product-images/{id}','Ghi: chủ sở hữu'),
 ('Categories','GET /api/categories; GET /api/categories/{id}','Công khai'),
 ('Categories','POST /api/categories; PUT/DELETE /api/categories/{id}','Admin'),
 ('Orders','GET /api/orders/me; GET /api/orders/{id}','JWT / liên quan hoặc Admin'),
 ('Orders','PATCH /api/orders/{id}/shipping-address; PATCH /api/orders/{id}/status','Buyer / Seller hoặc Admin'),
 ('Notifications','GET /api/notifications/me; PATCH /api/notifications/{id}/read; PATCH /api/notifications/read-all','JWT / của chính mình'),
 ('Users','GET/PUT /api/users/me; GET /api/users/me/bids','JWT'),
 ('Admin','GET /api/admin/users; PATCH /api/admin/users/{id}/status; PATCH /api/admin/products/{id}/cancel','Admin')])
para('Lọc sản phẩm hiện hỗ trợ tên danh mục dạng chuỗi qua ?category=; CategoryId đã được lưu/kiểm tra khi tạo hoặc sửa nhưng chưa có tham số lọc ?categoryId=. Địa chỉ giao hàng có thể cập nhật bởi Buyer; trạng thái đơn được Seller/Admin cập nhật thủ công.')
section('4.6','Đặc tả cột dữ liệu và tính toàn vẹn')
tbl(['Bảng','Cột chính và kiểu/ràng buộc','Ý nghĩa nghiệp vụ'],[
 ('Users','Id PK; Username/Email UQ; PasswordHash/Salt; Role; IsActive','Xác thực, vai trò và trạng thái khóa'),
 ('Categories','Id PK; Name nvarchar(100) UQ; Description nvarchar(500)','Danh mục chuẩn hóa'),
 ('Products','Id PK; StartingPrice/CurrentPrice decimal(18,2); StartTime/EndTime; RowVersion','Phiên đấu giá, giá hiện tại, chống ghi đè'),
 ('Bids','Id PK; ProductId/UserId FK; Amount decimal; BidTime UTC','Lịch sử giá và người đặt'),
 ('ProductImages','Id PK; ProductId? FK SetNull; CloudinaryPublicId, CloudinaryUrl','Metadata ảnh, không chứa binary'),
 ('Orders','Id PK; ProductId FK/UQ; BuyerId/SellerId FK; FinalPrice decimal; Status','Tối đa một đơn cho một phiên thắng'),
 ('Notifications','Id PK; UserId FK; Title, Message; IsRead, CreatedAt','Hộp thông báo cá nhân')])
para('Unique index trên Orders.ProductId chặn hai đơn cho cùng một sản phẩm ngay cả khi có nhiều worker. Categories.Name unique bảo vệ trùng tên; DeleteBehavior.SetNull đối với Products.CategoryId giữ sản phẩm nếu danh mục bị xóa. Order có Restrict đến Product và User để không xóa lịch sử giao dịch; Notification theo User Cascade. Số bản ghi thực tế có thể biến động khi demo, nên báo cáo không nêu tổng dòng như số liệu cố định.')
section('4.7','Thiết kế xác thực, phân quyền và phản hồi lỗi')
tbl(['Mã','Tình huống','Phản hồi / kiểm soát'],[
 ('200 / 201','GET thành công / POST tạo thành công','DTO, không trả entity EF hoặc mật khẩu'),
 ('400','DTO hoặc mức giá không hợp lệ','Thông tin lỗi và trace; không tạo bid'),
 ('401','Thiếu JWT / xác thực không đạt','Từ middleware hoặc đăng nhập'),
 ('403','Đã xác thực nhưng sai vai trò/chủ sở hữu','[Authorize(Roles)] + kiểm tra ID trong service/controller'),
 ('404','Không tìm thấy tài nguyên','Không trả dữ liệu đơn người khác'),
 ('409','Giá đổi, phiên đóng hoặc đăng ký trùng','Client tải lại trạng thái và thao tác lại'),
 ('429','Vượt hạn mức auth/bid','RateLimiter, queue=0')])
para('Bearer scheme trong OpenAPI giúp Swagger gửi JWT; role lấy từ token nhưng thao tác nhạy cảm cần kiểm tra trạng thái user trong DB. CORS không thay thế [Authorize]; chỉ giới hạn origin trình duyệt, client không phải trình duyệt vẫn phải được xác thực. Client phải dùng HTTPS khi triển khai thực tế để không lộ token trên đường truyền.')

part('PHẦN IV. TRIỂN KHAI VÀ KIỂM THỬ')
chapter(5,'XÂY DỰNG VÀ TRIỂN KHAI HỆ THỐNG')
section('5.1','Môi trường, thư viện và cấu trúc source')
tbl(['Thư mục/file','Trách nhiệm trong source'],[
 ('Program.cs','DI, JWT, OpenAPI/Swagger, CORS, RateLimiter và middleware'),
 ('Models/ + Data/AppDbContext.cs','7 entity, quan hệ, index và RowVersion'),
 ('Migrations/','5 lần thay đổi schema, gồm AddCategoriesOrdersNotifications'),
 ('DTOs/','Hợp đồng HTTP, validation và response DTO'),
 ('Controllers/','Route REST, kiểm tra quyền và gọi service/DbContext'),
 ('Services/ + Repositories/','Đặt giá, sản phẩm, xác thực, worker và truy vấn'),
 ('Hubs/','Nhóm SignalR cho một phiên đấu giá'),
 ('Tests/','Unit test InMemory và test SQL có điều kiện')])
para('Dự án target net10.0, phụ thuộc Microsoft.AspNetCore.Authentication.JwtBearer, Microsoft.AspNetCore.OpenApi, EF Core SQL Server, CloudinaryDotNet, Serilog, Scalar và Swagger UI. Thông tin kết nối SQL/JWT/Cloudinary không nằm trực tiếp trong tài liệu: trên máy demo chúng được cấp qua User Secrets; môi trường triển khai nên dùng biến môi trường hoặc secret store.')
section('5.2','Triển khai tài khoản, sản phẩm và ảnh')
para('AuthService băm mật khẩu với salt và không trả PasswordHash. UserService bảo vệ profile theo ID trong JWT. ProductService tạo phiên Scheduled, gắn SellerId từ CurrentUser thay vì nhận từ body, kiểm tra giá nguyên VND và mốc UTC. CategoryId được xác minh tồn tại khi tạo/sửa; nếu gửi tên danh mục trùng bảng chuẩn hóa thì ánh xạ lại ID; chuỗi tự do được giữ cho tương thích dữ liệu cũ. ProductImageService lưu file trên Cloudinary và metadata ở ProductImages.')
section('5.3','Đặt giá và chống tranh chấp đồng thời')
para('BidService xác minh Status=Active, StartTime ≤ now < EndTime, buyer khác seller, giá nguyên VND và bước tối thiểu 1.000 đồng. Trong cùng SaveChanges, hệ thống ghi Bid, CurrentPrice, thông báo người bán và (nếu cần) thông báo người đang dẫn đầu bị vượt. Product.RowVersion giải quyết hai request cùng đọc một giá: một request commit; request còn lại bị DbUpdateConcurrencyException, trả 409. Client phải tải lại giá để thử lượt mới, không tự ghi đè.')
section('5.4','Worker, đơn hàng và thông báo')
para('AuctionClosingService dùng IServiceScopeFactory mở scope mới trong từng lượt quét; quét tối đa 50 phiên Scheduled đến giờ mở và tối đa 50 phiên Active đã hết giờ, mỗi 5 giây. Khi đóng phiên, bid cao nhất thắng; nếu đồng giá, bid sớm hơn (rồi ID thấp hơn) thắng. Order.Pending và hai Notification được lưu cùng thay đổi trạng thái phiên; unique Order.ProductId bảo vệ một-đơn-một-sản-phẩm. Các sự kiện hub phát sau SaveChanges. OrdersController kiểm soát Buyer/Seller/Admin và chặn các bước chuyển trạng thái không hợp lệ.')
section('5.5','Cấu hình Swagger JWT, CORS và bảo mật')
tbl(['Cấu hình','Cách hiện thực','Lưu ý vận hành'],[
 ('OpenAPI Bearer','AddOpenApi document transformer + Swagger UI','Chỉ route có [Authorize] đánh dấu security'),
 ('CORS','FrontendOnly, WithOrigins(FrontendUrl), AllowCredentials','Không AllowAnyOrigin() trong production'),
 ('Pipeline','UseRouting → UseCors → UseAuthentication → UseRateLimiter → UseAuthorization','Thứ tự quan trọng với JWT/CORS'),
 ('Rate limit','auth 10/phút/IP; bid 30/phút/user','Vượt giới hạn trả 429; không xếp hàng'),
 ('Secrets','DefaultConnection, Jwt key, Cloudinary Account','Không đưa giá trị thật vào báo cáo/Git')])
section('5.6','Build, migration và publish')
figure('publish-bidnet.png','Hình 5.1. Quy trình build → publish → cấu hình host/SQL Server.')
para('Lệnh kiểm tra: dotnet build -p:BaseOutputPath=bin\\verify\\; dotnet test Tests/BidNet.Tests.csproj -p:BaseOutputPath=bin\\verify\\. Dùng đường dẫn output riêng vì server dev đang giữ BidNet.exe. Lệnh phát hành tham khảo: dotnet publish -c Release -o ./publish. Chưa có bằng chứng chạy trên IIS/Docker nên không kết luận đã triển khai production.')
section('5.7','Hình ảnh minh chứng hệ thống')
shot('06-swagger-new-groups.png','Hình 5.2. Swagger thật hiển thị ba nhóm Categories, Notifications, Orders trên server demo.',15.7)
shot('02-product-4-response.png','Hình 5.3. GET /api/products/4 trả 200 cho sản phẩm demo iPhone 15 Pro Max.',15.2)
shot('03-bid-history-public.png','Hình 5.4. GET /api/products/4/bids; lịch sử công khai không trả UserId.',15.2)
para('Ảnh nhóm endpoint mới chứng minh route đã đăng ký; GET /api/categories được xác minh HTTP 200 với 4 mục: Đồ điện tử & Công nghệ, Đồng hồ & Trang sức, Nghệ thuật & Đồ cổ, Xe cộ & Phụ tùng. Hai ảnh sản phẩm/bid được chụp trước khi thêm ba bảng mới, không chứng minh Orders/Notifications hoạt động. Cần thêm ảnh đăng nhập JWT và ca chốt đơn nếu giảng viên yêu cầu bằng chứng đầy đủ.')

chapter(6,'KIỂM THỬ VÀ ĐÁNH GIÁ')
section('6.1','Mục tiêu và môi trường kiểm thử')
para('Bộ kiểm thử xác minh xác thực, quyền theo chủ sở hữu, giá và thời gian, phân trang, worker và RowVersion. Máy kiểm thử dùng SDK .NET 10, SQL Server có database tạm chỉ dành cho bài kiểm tra concurrency; khi server đang chạy, đặt BaseOutputPath riêng để tránh khóa BidNet.exe. GET /api/categories được gọi qua HTTP cho dữ liệu seed hiện có; đây là smoke test, không thay thế test tích hợp cho CRUD/Orders/Notifications.')
section('6.2','Phương pháp kiểm thử và giới hạn chứng cứ')
tbl(['Lớp kiểm tra','Công cụ','Có thể kết luận / không thể kết luận'],[
 ('Unit / service','xUnit, Moq, EF InMemory','Kiểm quy tắc C#; không chứng minh ràng buộc FK, unique SQL'),
 ('Concurrency SQL','EF Core + SQL Server DB tạm GUID','RowVersion và rollback bid khi tranh chấp; chỉ chạy thật nếu BIDNET_TEST_SQL=1'),
 ('HTTP smoke','GET /api/categories, Swagger UI','Endpoint GET trả 200; chưa chứng minh toàn bộ API mới'),
 ('Build','dotnet build output riêng','Compile thành công; cảnh báo bảo mật vẫn còn')])
para('Trong lần xác minh báo cáo này, test SQL được chạy lại với BIDNET_TEST_SQL=1 và kết nối cấu hình qua User Secrets; database test tên GUID được tạo riêng rồi xóa sau test. Không in connection string hay credentials trong báo cáo. Dòng 11/11 khi không đặt biến môi trường vẫn có thể xuất hiện do test SQL return sớm, nên phải nêu rõ điều kiện chạy để không đánh đồng với SQL test thật.')
section('6.3','Ma trận 11 bài kiểm thử tự động')
tbl(['#','Bài test trong source','Nội dung xác minh'],[
 ('1','RegisterAndLogin_UsesHashedPasswordAndRejectsBlockedUser','Băm mật khẩu, JWT, khóa tài khoản'),
 ('2','Register_RejectsDuplicateUsernameOrEmail','Trùng username/email trả 409'),
 ('3','Product_ValidatesPriceAndKeepsSellerFromIdentity','Giá nguyên VND; SellerId từ JWT'),
 ('4','Bid_RejectsSellerAndInsufficientIncrement','Seller 403; bước giá sai 400'),
 ('5','Product_RejectsEditByAnotherUserAndAfterStart','Sai chủ 403; đã mở 409'),
 ('6','Bid_RejectsExpiredAuctionAndFractionalAmount','Hết giờ 409; giá lẻ 400'),
 ('7','Bid_RejectsInactiveAccountAndFutureAuction','Khóa user 403; chưa mở 409'),
 ('8','ProductList_PaginatesAndFiltersByStatus','Trả đúng TotalCount và item'),
 ('9','Worker_ClosesExpiredAuctionAndChoosesHighestBidder','Đóng phiên và chọn winner'),
 ('10','UserService_UpdatesProfile_AndPersistsThroughRepository','Sửa profile và lưu DB'),
 ('11','StaleBid_CannotOverwriteCommittedPrice','SQL RowVersion, một bid commit và một bid rollback')])
section('6.4','Kịch bản Swagger/Postman cần trình diễn')
tbl(['Mã','Bước và input tối thiểu','Kết quả mong đợi / trạng thái bằng chứng'],[
 ('H01','GET /api/categories không token','200 + 4 danh mục đã xác minh'),
 ('H02','POST /api/categories với User JWT','403 từ chính sách Admin; cần chụp HTTP'),
 ('H03','POST bid khi chính seller gọi','403 seller_cannot_bid; có test service'),
 ('H04','POST bid thấp hơn giá tối thiểu','400 bid_too_low; có test service'),
 ('H05','GET /api/orders/me với JWT buyer','Chỉ đơn liên quan; CHƯA có test tích hợp'),
 ('H06','PATCH /api/orders/{id}/status với role/transition sai','403 hoặc 400; CHƯA có test tích hợp'),
 ('H07','GET /api/notifications/me với JWT user','Chỉ thông báo của mình; CHƯA có test tích hợp'),
 ('H08','Worker kết thúc phiên có hai bid','Completed + Order Pending + thông báo; chưa test tích hợp toàn luồng'),
 ('H09','Hai request đặt giá dùng cùng RowVersion','Một lưu thành công, một xung đột; đã test SQL riêng')])
para('Không tự điền chữ “đạt” vào H02/H05–H08 khi chưa gọi HTTP trên bản server sau cập nhật. Người bảo vệ dùng script demo-data.ps1 và chụp ảnh mới, kiểm tra status cụ thể trước khi ký báo cáo. Seed nên giữ tên sản phẩm rõ nghĩa; tránh dữ liệu rác trước khi trình diễn.')
section('6.5','Kết quả đo được')
tbl(['Trường hợp','Kỳ vọng','Kết quả'],[
 ('Build bản mã hiện tại','0 lỗi','Đạt; 4 cảnh báo NuGet NU1902/NU1903'),
 ('dotnet test, BIDNET_TEST_SQL=1','11 test pass','Đạt: 11/11, 0 failed; test RowVersion chạy trên SQL riêng'),
 ('GET /api/categories','200 và danh mục mẫu','Đã xác nhận HTTP 200, 4 danh mục; cần chụp lại trước demo'),
 ('User thường tạo danh mục','403 Forbidden','Quyền Admin trong Controller; cần test HTTP sau khi restart'),
 ('Seller tự bid / bid quá thấp','403 / 400','Luồng nghiệp vụ trong BidService; demo qua Swagger'),
 ('Đặt giá đồng thời','409 Conflict','Có test SQL RowVersion; không ghi đè giá'),
 ('Worker chốt phiên','Order Pending + thông báo','Luồng có trong code; chưa có test tích hợp riêng cho 3 bảng mới')])
para('Các test 11/11 hiện có không bao phủ đầy đủ Orders, Categories, Notifications; không được xem 11/11 là bằng chứng toàn bộ tính năng mới không lỗi. Dùng dữ liệu demo sạch và chụp các ca 401/403, 400, 409, 201, 200 khi bảo vệ.')
section('6.6','Đánh giá, rủi ro và hướng khắc phục')
para('Chưa có frontend trong repository backend, chưa tích hợp thanh toán/shipper, và các API mới chưa có test tích hợp tự động. Gói phụ thuộc System.Security.Cryptography.Pkcs 9.0.11 đang phát cảnh báo bảo mật NU1902/NU1903 (phụ thuộc bắc cầu), cần nâng phiên bản tương thích. Auth rate limit 10/phút/IP, bid 30/phút/user; cấu hình CORS một origin.')

part('PHẦN V. TỔNG KẾT')
chapter(7,'KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN')
section('7.1','Kết quả đạt được')
para('BidNet xây dựng Web API đấu giá 7 bảng, 5 migrations, JWT + vai trò, đặt giá có RowVersion, worker chốt phiên và tạo đơn/thông báo, SignalR cập nhật sau commit. Kết quả đo trực tiếp: build 0 lỗi; 11/11 test hiện hữu pass. Tài liệu dùng sơ đồ ERD/use case, bảng endpoint và ảnh Swagger thật.')
section('7.2','Hạn chế và hướng phát triển')
para('Bổ sung test tích hợp cho danh mục/đơn/thông báo, lọc CategoryId và phân trang thông báo/đơn; phát triển frontend; tích hợp cổng thanh toán với xác minh webhook, vận chuyển và audit log; nâng gói phụ thuộc có cảnh báo bảo mật; chạy publish trên môi trường staging trước khi công bố.')
section('7.3','Đề xuất thứ tự ưu tiên')
tbl(['Ưu tiên','Việc cần làm','Tiêu chí hoàn thành'],[
 ('P1','Test HTTP quyền Orders/Notifications/Categories, worker có bid/no bid','Có test pass trên DB test và ảnh Swagger mới'),
 ('P1','Xử lý cảnh báo gói Pkcs và kiểm tra publish Release','dotnet restore/build không có advisory mức cao'),
 ('P2','Lọc categoryId, phân trang Orders/Notifications','Query không tải toàn bộ dữ liệu'),
 ('P3','Frontend và tích hợp thanh toán thật','Có webhook xác thực, log, môi trường staging')])
heading('TÀI LIỆU THAM KHẢO',1)
for t in ['Tài liệu Buổi 13: Swagger nâng cao, CORS, Publish và Triển khai.',
          'Tài liệu Buổi 14: Dự án tổng hợp, Tích hợp và Quy trình phát triển.',
          'Tài liệu Buổi 15: Kiểm thử, Báo cáo và Bảo vệ dự án.',
          'Mã nguồn BidNet: Models, DTOs, Controllers, Services, Program.cs, EF Core migrations và Tests.',
          'Microsoft Learn: ASP.NET Core Web API, EF Core, Identity/JWT, SignalR, Hosting.']:
 para('• '+t)

footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
footer.add_run('BidNet — Lập trình Web 2  |  ')
field=OxmlElement('w:fldSimple'); field.set(qn('w:instr'),'PAGE'); footer._p.append(field)
doc.core_properties.title='Báo cáo kết thúc môn Lập trình Web 2 — BidNet'
doc.core_properties.subject='Đồ án sàn đấu giá trực tuyến BidNet — buổi 15'
doc.save(OUT)
print(f'Created: {OUT} ({OUT.stat().st_size:,} bytes)')
