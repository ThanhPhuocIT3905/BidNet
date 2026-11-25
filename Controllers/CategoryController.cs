using BidNet.DTOs;
using BidNet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BidNet.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoryController(ICategoryService categories) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponseDto>>> List(CancellationToken ct) =>
        Ok(await categories.ListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryResponseDto>> Get(int id, CancellationToken ct) =>
        Ok(await categories.GetAsync(id, ct));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<CategoryResponseDto>> Create(
        CreateCategoryDto request, CancellationToken ct)
    {
        var result = await categories.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryResponseDto>> Update(
        int id, UpdateCategoryDto request, CancellationToken ct) =>
        Ok(await categories.UpdateAsync(id, request, ct));

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await categories.DeleteAsync(id, ct);
        return NoContent();
    }
}
