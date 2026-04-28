using SampleApi.Dtos;
using SampleApi.Models;

namespace SampleApi.Services;

public sealed class OrderService(IOrderRepository repo) : IOrderService
{
    public async Task<List<OrderDto>> ListAsync(CancellationToken ct = default)
    {
        var orders = await repo.ListAsync(ct);
        return orders.Select(Map).ToList();
    }

    public async Task<OrderDto?> GetAsync(int id, CancellationToken ct = default)
    {
        var o = await repo.GetAsync(id, ct);
        return o is null ? null : Map(o);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderRequest req, CancellationToken ct = default)
    {
        var order = new Order
        {
            Reference = $"ORD-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
            PlacedAt = DateTimeOffset.UtcNow,
            Status = "pending",
            CustomerId = req.CustomerId,
            Lines = req.Lines.Select(l => new OrderLine { ProductId = l.ProductId, Quantity = l.Quantity }).ToList(),
        };
        await repo.AddAsync(order, ct);
        await repo.SaveAsync(ct);
        return Map(order);
    }

    public async Task<OrderDto?> UpdateStatusAsync(int id, string status, CancellationToken ct = default)
    {
        var o = await repo.GetAsync(id, ct);
        if (o is null) return null;
        o.Status = status;
        await repo.SaveAsync(ct);
        return Map(o);
    }

    public Task DeleteAsync(int id, CancellationToken ct = default) => repo.RemoveAsync(id, ct);

    private static OrderDto Map(Order o) => new()
    {
        Id = o.Id,
        Reference = o.Reference,
        Status = o.Status,
        CustomerId = o.CustomerId,
        Lines = o.Lines.Select(l => new OrderLineDto { ProductId = l.ProductId, Quantity = l.Quantity }).ToList(),
    };
}
