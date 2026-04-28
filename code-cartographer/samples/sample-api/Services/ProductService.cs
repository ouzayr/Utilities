using Microsoft.EntityFrameworkCore;
using SampleApi.Data;
using SampleApi.Models;

namespace SampleApi.Services;

public interface IProductService
{
    Task<List<Product>> ListAsync(CancellationToken ct = default);
    Task<Product?> GetAsync(int id, CancellationToken ct = default);
}

public sealed class ProductService(AppDbContext db) : IProductService
{
    public Task<List<Product>> ListAsync(CancellationToken ct = default) => db.Products.ToListAsync(ct);
    public Task<Product?> GetAsync(int id, CancellationToken ct = default) => db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
}
