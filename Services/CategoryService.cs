using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Services;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponseDto>> ListAsync(CancellationToken ct);
    Task<CategoryResponseDto> GetAsync(int id, CancellationToken ct);
    Task<CategoryResponseDto> CreateAsync(CreateCategoryDto request, CancellationToken ct);
    Task<CategoryResponseDto> UpdateAsync(int id, UpdateCategoryDto request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

public class CategoryService(AppDbContext db, CurrentUser currentUser) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryResponseDto>> ListAsync(CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => new CategoryResponseDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                ProductCount = c.Products.Count,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(ct);

    public async Task<CategoryResponseDto> GetAsync(int id, CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryResponseDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                ProductCount = c.Products.Count,
                CreatedAt = c.CreatedAt
            })
            .FirstOrDefaultAsync(ct)
        ?? throw new ApiException(404, "category_not_found", "Không tìm thấy danh mục.");

    public async Task<CategoryResponseDto> CreateAsync(CreateCategoryDto request, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new ApiException(400, "invalid_category_name", "Tên danh mục không được để trống.");
        if (await db.Categories.AnyAsync(c => c.Name == name, ct))
            throw new ApiException(409, "category_exists", "Tên danh mục đã tồn tại.");

        var category = new Category
        {
            Name = name,
            Description = request.Description?.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);

        return new CategoryResponseDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            ProductCount = 0,
            CreatedAt = category.CreatedAt
        };
    }

    public async Task<CategoryResponseDto> UpdateAsync(int id, UpdateCategoryDto request, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new ApiException(404, "category_not_found", "Không tìm thấy danh mục.");

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new ApiException(400, "invalid_category_name", "Tên danh mục không được để trống.");
        if (await db.Categories.AnyAsync(c => c.Id != id && c.Name == name, ct))
            throw new ApiException(409, "category_exists", "Tên danh mục đã tồn tại.");

        category.Name = name;
        category.Description = request.Description?.Trim();
        await db.SaveChangesAsync(ct);

        var count = await db.Products.CountAsync(p => p.CategoryId == id, ct);
        return new CategoryResponseDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            ProductCount = count,
            CreatedAt = category.CreatedAt
        };
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new ApiException(404, "category_not_found", "Không tìm thấy danh mục.");
        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
    }
}
