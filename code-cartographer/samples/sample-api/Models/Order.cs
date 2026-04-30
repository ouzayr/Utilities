namespace SampleApi.Models;

public sealed class Order
{
    public int Id { get; set; }
    public string Reference { get; set; } = "";
    public DateTimeOffset PlacedAt { get; set; }
    public string Status { get; set; } = "pending";
    public int CustomerId { get; set; }
    public List<OrderLine> Lines { get; set; } = new();
}

public sealed class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}
