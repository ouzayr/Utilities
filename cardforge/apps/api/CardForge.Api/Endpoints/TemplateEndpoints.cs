using CardForge.Application.DTOs.Template;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class TemplateEndpoints
{
    public static void MapTemplateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/templates").WithTags("Templates").RequireAuthorization();

        group.MapGet("/", async (ITemplateService templates, CancellationToken ct) =>
            Results.Ok(await templates.GetAllAsync(ct)));

        group.MapGet("/{id:guid}", async (Guid id, ITemplateService templates, CancellationToken ct) =>
            Results.Ok(await templates.GetByIdAsync(id, ct)));

        group.MapPost("/", async (CreateTemplateRequest request, ITemplateService templates, CancellationToken ct) =>
        {
            var result = await templates.CreateAsync(request, ct);
            return Results.Created($"/api/templates/{result.Id}", result);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTemplateRequest request, ITemplateService templates, CancellationToken ct) =>
            Results.Ok(await templates.UpdateAsync(id, request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, ITemplateService templates, CancellationToken ct) =>
        {
            await templates.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/publish", async (Guid id, ITemplateService templates, CancellationToken ct) =>
            Results.Ok(await templates.PublishAsync(id, ct)));
    }
}
