namespace SampleApi.Dtos;

public sealed class OrderDto
{
    public int Id { get; set; }
    public string Reference { get; set; } = "";
    public string Status { get; set; } = "";
    public int CustomerId { get; set; }
    public List<OrderLineDto> Lines { get; set; } = new();
}

public sealed class OrderLineDto
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}

public sealed class CreateOrderRequest
{
    public int CustomerId { get; set; }
    public List<OrderLineDto> Lines { get; set; } = new();
}

public sealed class UpdateOrderStatusRequest
{
    public string Status { get; set; } = "";
}
