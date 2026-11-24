# ==============================================================================
# Dockerfile - Đóng gói ứng dụng BidNet Web API (.NET 10) theo chuẩn Buổi 13
# Multi-stage build: tách biệt môi trường Build (SDK) và Runtime tối ưu dung lượng
# ==============================================================================

# Giai đoạn 1: Base Runtime Image (Nhẹ, chỉ chứa runtime cần thiết để chạy)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Giai đoạn 2: Build Image (Chứa đầy đủ .NET SDK để biên dịch)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy file dự án và restore trước để tận dụng Docker Cache layer
COPY ["BidNet.csproj", "./"]
RUN dotnet restore "BidNet.csproj"

# Copy toàn bộ mã nguồn và build Release
COPY . .
WORKDIR "/src"
RUN dotnet build "BidNet.csproj" -c Release -o /app/build

# Giai đoạn 3: Publish ứng dụng
FROM build AS publish
RUN dotnet publish "BidNet.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Giai đoạn 4: Final Container chạy ứng dụng
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "BidNet.dll"]
