using CardForge.Domain.Enums;

namespace CardForge.Domain.Entities;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public SubscriptionTier Tier { get; set; }
    public string Status { get; set; } = "Active";
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Tenant? Tenant { get; set; }
    public BillingDetails? BillingDetails { get; set; }
}
