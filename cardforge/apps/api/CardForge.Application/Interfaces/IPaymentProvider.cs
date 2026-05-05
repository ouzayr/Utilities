namespace CardForge.Application.Interfaces;

public interface IPaymentProvider
{
    Task<PaymentResult> ChargeAsync(string customerId, int amountCents, string currency, CancellationToken ct = default);
    Task<PaymentResult> CancelSubscriptionAsync(string externalSubscriptionId, CancellationToken ct = default);
}

public record PaymentResult(bool Success, string? ExternalCustomerId, string? ExternalInvoiceId, string? Error);
