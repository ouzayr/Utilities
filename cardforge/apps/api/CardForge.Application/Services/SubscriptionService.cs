using CardForge.Application.DTOs.Subscription;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface ISubscriptionService
{
    Task<SubscriptionTier> GetActiveTierAsync(Guid tenantId, CancellationToken ct = default);
    Task<List<SubscriptionDto>> GetForTenantAsync(CancellationToken ct = default);
    Task<SubscriptionDto> CreateAsync(CreateSubscriptionRequest request, CancellationToken ct = default);
    Task<SubscriptionDto> CancelAsync(Guid subscriptionId, CancellationToken ct = default);
    Task<BillingDetailsDto> GetBillingAsync(Guid subscriptionId, CancellationToken ct = default);
}

public class SubscriptionService : ISubscriptionService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly IPaymentProvider _payment;
    private readonly ILogger<SubscriptionService> _logger;

    public SubscriptionService(
        IAppDbContext db,
        ICurrentTenant currentTenant,
        IPaymentProvider payment,
        ILogger<SubscriptionService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _payment = payment;
        _logger = logger;
    }

    public async Task<SubscriptionTier> GetActiveTierAsync(Guid tenantId, CancellationToken ct = default)
    {
        var activeSub = await _db.Subscriptions
            .Where(s => s.TenantId == tenantId && s.Status == "Active")
            .OrderByDescending(s => s.Tier)
            .FirstOrDefaultAsync(ct);

        return activeSub?.Tier ?? SubscriptionTier.Starter;
    }

    public async Task<List<SubscriptionDto>> GetForTenantAsync(CancellationToken ct = default)
    {
        var tenantId = RequireTenantId();
        var subs = await _db.Subscriptions
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        return subs.Select(MapDto).ToList();
    }

    public async Task<SubscriptionDto> CreateAsync(CreateSubscriptionRequest request, CancellationToken ct = default)
    {
        var tenantId = RequireTenantId();
        AssertClientAdminOrAbove();

        var paymentResult = await _payment.ChargeAsync(
            tenantId.ToString(), request.AmountCents, request.Currency, ct);

        if (!paymentResult.Success)
        {
            _logger.LogWarning("Payment failed for tenant {TenantId}: {Error}", tenantId, paymentResult.Error);
            throw new ConflictException($"Payment failed: {paymentResult.Error}");
        }

        var existing = await _db.Subscriptions
            .Where(s => s.TenantId == tenantId && s.Status == "Active")
            .ToListAsync(ct);

        foreach (var old in existing)
        {
            old.Status = "Cancelled";
            old.EndsAt = DateTimeOffset.UtcNow;
        }

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tier = request.Tier,
            Status = "Active",
            StartsAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var billing = new BillingDetails
        {
            Id = Guid.NewGuid(),
            SubscriptionId = subscription.Id,
            ExternalCustomerId = paymentResult.ExternalCustomerId,
            ExternalInvoiceId = paymentResult.ExternalInvoiceId,
            AmountCents = request.AmountCents,
            Currency = request.Currency,
            PaidAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Subscriptions.Add(subscription);
        _db.BillingDetails.Add(billing);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Tenant {TenantId} upgraded to {Tier}", tenantId, request.Tier);
        return MapDto(subscription);
    }

    public async Task<SubscriptionDto> CancelAsync(Guid subscriptionId, CancellationToken ct = default)
    {
        var tenantId = RequireTenantId();
        AssertClientAdminOrAbove();

        var sub = await _db.Subscriptions.FindAsync([subscriptionId], ct)
            ?? throw new NotFoundException("Subscription", subscriptionId);

        if (sub.TenantId != tenantId && !_currentTenant.IsSuperAdmin)
            throw new ForbiddenException();

        sub.Status = "Cancelled";
        sub.EndsAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Subscription {SubscriptionId} cancelled", subscriptionId);
        return MapDto(sub);
    }

    public async Task<BillingDetailsDto> GetBillingAsync(Guid subscriptionId, CancellationToken ct = default)
    {
        var tenantId = RequireTenantId();

        var billing = await _db.BillingDetails
            .Include(b => b.Subscription)
            .FirstOrDefaultAsync(b => b.SubscriptionId == subscriptionId, ct)
            ?? throw new NotFoundException("BillingDetails", subscriptionId);

        if (billing.Subscription!.TenantId != tenantId && !_currentTenant.IsSuperAdmin)
            throw new ForbiddenException();

        return new BillingDetailsDto(billing.Id, billing.SubscriptionId,
            billing.ExternalCustomerId, billing.ExternalInvoiceId,
            billing.PaymentMethod, billing.AmountCents, billing.Currency, billing.PaidAt);
    }

    private Guid RequireTenantId() =>
        _currentTenant.TenantId ?? throw new ForbiddenException("No tenant context.");

    private void AssertClientAdminOrAbove()
    {
        var role = _currentTenant.Role ?? throw new ForbiddenException();
        if (role > UserRole.ClientAdmin && !_currentTenant.IsSuperAdmin)
            throw new ForbiddenException("Only a Client Admin or above can manage subscriptions.");
    }

    private static SubscriptionDto MapDto(Subscription s) =>
        new(s.Id, s.TenantId, s.Tier, s.Status, s.StartsAt, s.EndsAt, s.CreatedAt);
}
