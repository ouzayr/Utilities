using CardForge.Domain.Enums;

namespace CardForge.Application.DTOs.Subscription;

public record SubscriptionDto(
    Guid Id,
    Guid TenantId,
    SubscriptionTier Tier,
    string Status,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    DateTimeOffset CreatedAt
);

public record BillingDetailsDto(
    Guid Id,
    Guid SubscriptionId,
    string? ExternalCustomerId,
    string? ExternalInvoiceId,
    string? PaymentMethod,
    int AmountCents,
    string Currency,
    DateTimeOffset? PaidAt
);

public record CreateSubscriptionRequest(SubscriptionTier Tier, int AmountCents, string Currency = "USD");
