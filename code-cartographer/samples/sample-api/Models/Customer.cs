namespace SampleApi.Models;

public sealed class Customer
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
}
