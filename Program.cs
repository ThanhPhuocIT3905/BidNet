using System.Text;
using System.Threading.RateLimiting;
using BidNet.Data;
using BidNet.Hubs;
using BidNet.Middleware;
using BidNet.Repositories;
using BidNet.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

// Program.cs là điểm khởi động: nạp cấu hình, đăng ký dịch vụ rồi ghép HTTP pipeline.
var builder = WebApplication.CreateBuilder(args);
// Controller xử lý request; OpenAPI tạo tài liệu cho Swagger/Scalar.
builder.Services.AddControllers();
builder.Services.AddOpenApi(options =>
{
    // Khai báo Bearer để Swagger hiện nút Authorize. Chỉ route có [Authorize]
    // mới được đánh dấu cần token; đăng ký/đăng nhập vẫn gọi được công khai.
    options.AddDocumentTransformer((document, context, _) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        };
        // Duyệt mô tả endpoint sau khi tài liệu đã tạo. Khi đó tham chiếu
        // security scheme có document gốc nên không bị xuất thành object rỗng.
        foreach (var description in context.DescriptionGroups.SelectMany(group => group.Items))
        {
            if (!description.ActionDescriptor.EndpointMetadata.OfType<IAuthorizeData>().Any())
                continue;
            var route = "/" + System.Text.RegularExpressions.Regex.Replace(
                description.RelativePath?.Split('?')[0] ?? "",
                @"\{([^}:]+):[^}]+\}", "{$1}");
            // OpenAPI dùng {id}, còn route ASP.NET có thể là {id:int}.
            if (!document.Paths.TryGetValue(route, out var path) || path.Operations is null)
                continue;
            foreach (var (method, operation) in path.Operations)
            {
                if (!method.ToString().Equals(description.HttpMethod, StringComparison.OrdinalIgnoreCase))
                    continue;
                operation.Security ??= [];
                operation.Security.Add(new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference("Bearer", document)] = []
                });
            }
        }
        return Task.CompletedTask;
    });
});
builder.Services.AddHttpContextAccessor();

// Không lưu kết nối SQL của một thành viên trong Git: mỗi máy đặt User Secrets
// hoặc biến môi trường riêng. DI tạo AppDbContext cho từng request khi cần.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Thiếu ConnectionStrings:DefaultConnection. Hãy cấu hình qua User Secrets hoặc biến môi trường.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

// Khóa ký JWT là bí mật; thiếu khóa hoặc khóa quá ngắn thì dừng ngay lúc khởi động.
// Nhờ vậy ứng dụng không chạy với token được ký bằng giá trị mặc định yếu.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Cần cấu hình Jwt:Key có ít nhất 32 byte.");
// Token hợp lệ phải đúng chữ ký, issuer, audience và thời hạn.
// ClockSkew 30 giây cho phép lệch đồng hồ nhỏ giữa các máy trong nhóm.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            // WebSocket trong trình duyệt khó gửi Authorization header. Chỉ hub
            // đấu giá mới đọc access_token trên query; các API REST dùng header.
            OnMessageReceived = context =>
            {
                if (context.Request.Path.StartsWithSegments("/hubs/auction") &&
                    context.Request.Query.TryGetValue("access_token", out var token))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddSignalR();

// Chặn thử mật khẩu liên tục theo IP và spam đặt giá theo người dùng/IP.
// Hết quota trả 429 ngay, không xếp hàng chờ để tránh dồn request.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
    options.AddPolicy("bid", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});

// Scoped service dùng chung DbContext của một request; worker là singleton
// chạy nền nên tự tạo scope mới mỗi lần truy cập database.
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IBidService, BidService>();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IBidRepository, BidRepository>();
builder.Services.AddHostedService<AuctionClosingService>();

var app = builder.Build();
// Middleware bắt ApiException và lỗi bất ngờ; StatusCodePages bổ sung JSON
// cho 401/403/404/429 phát sinh ngoài controller.
app.UseMiddleware<ExceptionMiddleware>();
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    response.ContentType = "application/problem+json";
    await response.WriteAsJsonAsync(new ProblemDetails
    {
        Status = response.StatusCode,
        Title = response.StatusCode switch
        {
            401 => "Cần đăng nhập.",
            403 => "Không có quyền truy cập.",
            404 => "Không tìm thấy tài nguyên.",
            429 => "Thao tác quá thường xuyên.",
            _ => "Yêu cầu không thành công."
        }
    });
});
// Đặt HTTPS trước Swagger: nếu vào trang bằng HTTP, cả trang được chuyển sang
// HTTPS; tránh trình duyệt chặn fetch JSON vì redirect khác origin.
app.UseHttpsRedirection();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    // Swagger UI đọc cùng tài liệu OpenAPI; chỉ mở trong môi trường Development.
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "BidNet API v1"));
}
app.UseRouting();
// Thứ tự quan trọng: đọc JWT trước để rate limit biết tài khoản nào đang gọi,
// sau đó Authorization mới kiểm tra [Authorize]/vai trò Admin.
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHub<AuctionHub>("/hubs/auction");
app.Run();
