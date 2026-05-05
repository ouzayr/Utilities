using CardForge.Application.DTOs.Subscription;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class SubscriptionEndpoints
{
    public static void MapSubscriptionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/subscriptions").WithTags("Subscriptions").RequireAuthorization();

        group.MapGet("/", async (ISubscriptionService subscriptions, CancellationToken ct) =>
            Results.Ok(await subscriptions.GetForTenantAsync(ct)));

        group.MapPost("/", async (CreateSubscriptionRequest request, ISubscriptionService subscriptions, CancellationToken ct) =>
        {
            var result = await subscriptions.CreateAsync(request, ct);
            return Results.Created($"/api/subscriptions/{result.Id}", result);
        });

        group.MapPut("/{id:guid}/cancel", async (Guid id, ISubscriptionService subscriptions, CancellationToken ct) =>
            Results.Ok(await subscriptions.CancelAsync(id, ct)));

        group.MapGet("/{id:guid}/billing", async (Guid id, ISubscriptionService subscriptions, CancellationToken ct) =>
            Results.Ok(await subscriptions.GetBillingAsync(id, ct)));
    }
}
