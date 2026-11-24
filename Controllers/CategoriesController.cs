using BidNet.Data;
using BidNet.DTOs;
using BidNet.Exceptions;
using BidNet.Models;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BidNet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController(AppDbContext db, CurrentUser currentUser) : ControllerBase
{
    // READ ALL: Xem toàn bộ danh mục sản phẩm (Ai cũng xem được)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryResponseDto>>> GetAll(CancellationToken ct)
    {
        var categories = await db.Categories.AsNoTracking()
            .Select(c => new CategoryResponseDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                CreatedAt = c.CreatedAt,
                ProductCount = c.Products.Count
            })
            .ToListAsync(ct);

        return Ok(categories);
    }

    // READ ONE: Xem chi tiết 1 danh mục theo ID
    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryResponseDto>> GetById(int id, CancellationToken ct)
    {
        var category = await db.Categories.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryResponseDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                CreatedAt = c.CreatedAt,
                ProductCount = c.Products.Count
            })
            .FirstOrDefaultAsync(ct);

        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục có ID {id}.");

        return Ok(category);
    }

    // CREATE: Tạo danh mục mới (Chỉ Admin mới có quyền)
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<CategoryResponseDto>> Create([FromBody] CategoryCreateDto dto, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new BadRequestException("Tên danh mục không được để trống.");
        // Kiểm tra xem tên danh mục đã tồn tại chưa
        var exists = await db.Categories.AnyAsync(c => c.Name.ToLower() == dto.Name.Trim().ToLower(), ct);
        if (exists)
            throw new BadRequestException($"Danh mục '{dto.Name}' đã tồn tại trong hệ thống.");

        var category = new Category
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, new CategoryResponseDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            CreatedAt = category.CreatedAt,
            ProductCount = 0
        });
    }

    // UPDATE: Chỉnh sửa thông tin danh mục (Chỉ Admin)
    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryResponseDto>> Update(int id, [FromBody] CategoryUpdateDto dto, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new BadRequestException("Tên danh mục không được để trống.");
        var category = await db.Categories.FindAsync([id], ct);
        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục có ID {id}.");

        // Kiểm tra xem tên mới có trùng với danh mục khác không
        var duplicate = await db.Categories.AnyAsync(c => c.Id != id && c.Name.ToLower() == dto.Name.Trim().ToLower(), ct);
        if (duplicate)
            throw new BadRequestException($"Tên danh mục '{dto.Name}' đã được sử dụng.");

        category.Name = dto.Name.Trim();
        category.Description = dto.Description?.Trim();

        await db.SaveChangesAsync(ct);

        return Ok(new CategoryResponseDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            CreatedAt = category.CreatedAt,
            ProductCount = await db.Products.CountAsync(p => p.CategoryId == id, ct)
        });
    }

    // DELETE: Xóa danh mục (Chỉ Admin)
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await currentUser.RequireActiveAsync(ct);
        var category = await db.Categories.FindAsync([id], ct);
        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục có ID {id}.");

        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
