using CardForge.Application.DTOs.Tenant;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class TenantEndpoints
{
    public static void MapTenantEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tenants").WithTags("Tenants").RequireAuthorization();

        group.MapGet("/", async (ITenantService tenants, CancellationToken ct) =>
            Results.Ok(await tenants.GetAllAsync(ct)));

        group.MapGet("/{id:guid}", async (Guid id, ITenantService tenants, CancellationToken ct) =>
            Results.Ok(await tenants.GetByIdAsync(id, ct)));

        group.MapPost("/", async (CreateTenantRequest request, ITenantService tenants, CancellationToken ct) =>
        {
            var result = await tenants.CreateAsync(request, ct);
            return Results.Created($"/api/tenants/{result.Id}", result);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTenantRequest request, ITenantService tenants, CancellationToken ct) =>
            Results.Ok(await tenants.UpdateAsync(id, request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, ITenantService tenants, CancellationToken ct) =>
        {
            await tenants.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        group.MapPut("/{id:guid}/policy", async (Guid id, UpdateTenantPolicyRequest request, ITenantService tenants, CancellationToken ct) =>
            Results.Ok(await tenants.UpdatePolicyAsync(id, request, ct)));
    }
}
