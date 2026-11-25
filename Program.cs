using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using BidNet.Data;
using BidNet.Hubs;
using BidNet.Middleware;
using BidNet.Repositories;
using BidNet.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

// Program.cs là điểm khởi động: nạp cấu hình, đăng ký dịch vụ rồi ghép HTTP pipeline.
var builder = WebApplication.CreateBuilder(args);

// Controller xử lý request; chuẩn hóa lỗi ModelState (400) có thêm trường "code"
// đồng nhất với ExceptionMiddleware.
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problem = new ValidationProblemDetails(context.ModelState)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Dữ liệu gửi lên không hợp lệ."
            };
            problem.Extensions["code"] = "validation_error";
            return new BadRequestObjectResult(problem)
            {
                ContentTypes = { "application/problem+json" }
            };
        };
    });

// CORS cho phép Frontend (React/Vue/Angular...) và SignalR gọi API từ origin khác.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        else
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddOpenApi(options =>
{
    // Khai báo Bearer để Swagger hiện nút Authorize. Chỉ route có [Authorize]
    // và không bị [AllowAnonymous] mới đánh dấu cần token.
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
        foreach (var description in context.DescriptionGroups.SelectMany(group => group.Items))
        {
            var metadata = description.ActionDescriptor.EndpointMetadata;
            if (!metadata.OfType<IAuthorizeData>().Any() || metadata.OfType<IAllowAnonymous>().Any())
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

// Không lưu kết nối SQL trong Git: mỗi máy đặt User Secrets hoặc biến môi trường riêng.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Thiếu ConnectionStrings:DefaultConnection. Hãy cấu hình qua User Secrets hoặc biến môi trường.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

// Khóa ký JWT là bí mật; thiếu khóa hoặc khóa quá ngắn thì dừng ngay lúc khởi động.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Cần cấu hình Jwt:Key có ít nhất 32 byte qua User Secrets hoặc biến môi trường.");

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

// Chặn thử mật khẩu liên tục theo IP, spam đặt giá và spam upload theo UserId/IP.
static string UserOrIpPartition(HttpContext context) =>
    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? context.Connection.RemoteIpAddress?.ToString()
    ?? "unknown";

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
        UserOrIpPartition(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
    options.AddPolicy("upload", context => RateLimitPartition.GetFixedWindowLimiter(
        UserOrIpPartition(context),
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});

// Scoped service dùng chung DbContext của một request; worker là singleton
// chạy nền nên tự tạo scope mới mỗi lần truy cập database.
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IBidService, BidService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IProductImageService, ProductImageService>();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<IFileRepository, FileRepository>();
builder.Services.AddScoped<IFileService, FileService>();
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
// Chỉ ép chuyển hướng HTTPS ngoài môi trường Development để tránh 307 Redirect
// làm lỗi CORS preflight/SignalR khi Frontend gọi http://localhost:5014 ở local.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    // Swagger UI đọc cùng tài liệu OpenAPI; chỉ mở trong môi trường Development.
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "BidNet API v1"));
}
app.UseRouting();
app.UseCors("Frontend");
// Thứ tự quan trọng: đọc JWT trước để rate limit biết tài khoản nào đang gọi,
// sau đó Authorization mới kiểm tra [Authorize]/vai trò Admin.
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHub<AuctionHub>("/hubs/auction");
app.Run();
