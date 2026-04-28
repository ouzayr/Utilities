using Microsoft.EntityFrameworkCore;
using SampleApi.Data;
using SampleApi.Models;

namespace SampleApi.Services;

public sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public Task<List<Order>> ListAsync(CancellationToken ct = default) => db.Orders.Include(o => o.Lines).ToListAsync(ct);
    public Task<Order?> GetAsync(int id, CancellationToken ct = default) => db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, ct);
    public async Task<Order> AddAsync(Order o, CancellationToken ct = default)
    {
        await db.Orders.AddAsync(o, ct);
        return o;
    }
    public Task SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);
    public async Task RemoveAsync(int id, CancellationToken ct = default)
    {
        var existing = await db.Orders.FindAsync(new object[] { id }, ct);
        if (existing is null) return;
        db.Orders.Remove(existing);
        await db.SaveChangesAsync(ct);
    }
}
