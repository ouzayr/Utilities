using SampleApi.Dtos;
using SampleApi.Models;

namespace SampleApi.Services;

public interface IOrderService
{
    Task<List<OrderDto>> ListAsync(CancellationToken ct = default);
    Task<OrderDto?> GetAsync(int id, CancellationToken ct = default);
    Task<OrderDto> CreateAsync(CreateOrderRequest req, CancellationToken ct = default);
    Task<OrderDto?> UpdateStatusAsync(int id, string status, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}

public interface IOrderRepository
{
    Task<List<Order>> ListAsync(CancellationToken ct = default);
    Task<Order?> GetAsync(int id, CancellationToken ct = default);
    Task<Order> AddAsync(Order o, CancellationToken ct = default);
    Task SaveAsync(CancellationToken ct = default);
    Task RemoveAsync(int id, CancellationToken ct = default);
}
