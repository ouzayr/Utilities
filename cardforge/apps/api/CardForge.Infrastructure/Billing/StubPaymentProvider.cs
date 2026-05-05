using CardForge.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace CardForge.Infrastructure.Billing;

public class StubPaymentProvider : IPaymentProvider
{
    private readonly ILogger<StubPaymentProvider> _logger;

    public StubPaymentProvider(ILogger<StubPaymentProvider> logger) => _logger = logger;

    public Task<PaymentResult> ChargeAsync(string customerId, int amountCents, string currency, CancellationToken ct = default)
    {
        _logger.LogInformation("[STUB] Charge {AmountCents} {Currency} for customer {CustomerId}", amountCents, currency, customerId);
        var result = new PaymentResult(
            Success: true,
            ExternalCustomerId: $"stub_cust_{customerId[..8]}",
            ExternalInvoiceId: $"stub_inv_{Guid.NewGuid():N}",
            Error: null);
        return Task.FromResult(result);
    }

    public Task<PaymentResult> CancelSubscriptionAsync(string externalSubscriptionId, CancellationToken ct = default)
    {
        _logger.LogInformation("[STUB] Cancel subscription {ExternalSubscriptionId}", externalSubscriptionId);
        return Task.FromResult(new PaymentResult(true, null, null, null));
    }
}
