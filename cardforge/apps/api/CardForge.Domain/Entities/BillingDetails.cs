namespace CardForge.Domain.Entities;

public class BillingDetails
{
    public Guid Id { get; set; }
    public Guid SubscriptionId { get; set; }
    public string? ExternalCustomerId { get; set; }
    public string? ExternalInvoiceId { get; set; }
    public string? PaymentMethod { get; set; }
    public int AmountCents { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Subscription? Subscription { get; set; }
}
