using BidNet.Data;
using BidNet.DTOs;
using BidNet.Models;
using BidNet.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace BidNet.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductController : ControllerBase
    {
        private readonly AppDbContext _ctx;
        private readonly IBidRepository _bidRepo;
        private readonly IUserRepository _userRepo;

        public ProductController(AppDbContext ctx, IBidRepository bidRepo, IUserRepository userRepo)
        {
            _ctx = ctx;
            _bidRepo = bidRepo;
            _userRepo = userRepo;
        }

        // GET: api/products
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductResponseDto>>> GetProducts(
            [FromQuery] string? category = null,
            [FromQuery] decimal? minPrice = null,
            [FromQuery] decimal? maxPrice = null)
        {
            var query = _ctx.Products
                .Where(p => p.Status == ProductStatus.Active)
                .Include(p => p.Seller)
                .Include(p => p.Winner)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(p => p.Category == category);
            if (minPrice.HasValue)
                query = query.Where(p => p.StartingPrice >= minPrice.Value);
            if (maxPrice.HasValue)
                query = query.Where(p => p.StartingPrice <= maxPrice.Value);

            var products = await query
                .OrderBy(p => p.StartTime)
                .Select(p => new ProductResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    StartingPrice = p.StartingPrice,
                    CurrentPrice = p.CurrentPrice,
                    StartTime = p.StartTime,
                    EndTime = p.EndTime,
                    Status = p.Status.ToString(),
                    ImageUrl = p.ImageUrl,
                    Category = p.Category,
                    SellerId = p.SellerId,
                    SellerName = p.Seller.Username,
                    WinnerId = p.WinnerId,
                    WinnerName = p.Winner != null ? p.Winner.Username : null,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(products);
        }

        // GET: api/products/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ProductResponseDto>> GetProduct(int id)
        {
            var product = await _ctx.Products
                .Include(p => p.Seller)
                .Include(p => p.Winner)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            var dto = new ProductResponseDto
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                StartingPrice = product.StartingPrice,
                CurrentPrice = product.CurrentPrice,
                StartTime = product.StartTime,
                EndTime = product.EndTime,
                Status = product.Status.ToString(),
                ImageUrl = product.ImageUrl,
                Category = product.Category,
                SellerId = product.SellerId,
                SellerName = product.Seller.Username,
                WinnerId = product.WinnerId,
                WinnerName = product.Winner?.Username,
                CreatedAt = product.CreatedAt
            };

            return Ok(dto);
        }

        // POST: api/products   (requires auth – will add [Authorize] later)
        [HttpPost]
        public async Task<ActionResult<ProductResponseDto>> CreateProduct([FromBody] CreateProductDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // TODO: replace hard-coded sellerId with current user id from JWT claims
            int sellerId = 1;

            var product = new Product
            {
                Name = dto.Name,
                Description = dto.Description,
                StartingPrice = dto.StartingPrice,
                CurrentPrice = dto.StartingPrice,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime,
                ImageUrl = dto.ImageUrl,
                Category = dto.Category,
                SellerId = sellerId,
                Status = ProductStatus.Active
            };

            _ctx.Products.Add(product);
            await _ctx.SaveChangesAsync();

            var resultDto = new ProductResponseDto
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                StartingPrice = product.StartingPrice,
                CurrentPrice = product.CurrentPrice,
                StartTime = product.StartTime,
                EndTime = product.EndTime,
                Status = product.Status.ToString(),
                ImageUrl = product.ImageUrl,
                Category = product.Category,
                SellerId = product.SellerId,
                SellerName = "", // will be filled after user repo is ready
                WinnerId = null,
                WinnerName = null,
                CreatedAt = product.CreatedAt
            };

            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, resultDto);
        }

        // POST: api/products/5/bid   (place a bid)
        [HttpPost("{id}/bid")]
        public async Task<ActionResult> PlaceBid(int id, [FromBody] decimal bidAmount)
        {
            var product = await _ctx.Products.FindAsync(id);
            if (product == null)
                return NotFound();

            var now = DateTime.UtcNow;

            // ---- Business validation ----
            if (now < product.StartTime)
                return BadRequest("Auction has not started yet.");
            if (now > product.EndTime)
                return BadRequest("Auction has ended.");
            if (product.Status != ProductStatus.Active)
                return BadRequest("Product is not active.");

            if (bidAmount <= product.CurrentPrice)
                return BadRequest("Bid amount must be greater than current price.");
            if (bidAmount < product.StartingPrice)
                return BadRequest("Bid amount cannot be lower than starting price.");

            // ---- Create bid ----
            // TODO: replace hard-coded userId with current user id from JWT claims
            int userId = 2;

            var bid = new Bid
            {
                ProductId = id,
                UserId = userId,
                Amount = bidAmount,
                BidTime = now
            };

            await _ctx.Bids.AddAsync(bid);

            // Update product's current price
            product.CurrentPrice = bidAmount;
            await _ctx.SaveChangesAsync();

            // TODO: Publish SignalR event here if Hub is available
            return Ok(new { message = "Bid placed successfully", newPrice = product.CurrentPrice });
        }
    }
}