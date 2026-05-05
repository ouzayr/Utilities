using CardForge.Application.DTOs.Card;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class CardEndpoints
{
    public static void MapCardEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/cards").WithTags("Cards").RequireAuthorization();

        group.MapGet("/", async (ICardService cards, CancellationToken ct) =>
            Results.Ok(await cards.GetAllAsync(ct)));

        group.MapGet("/{id:guid}", async (Guid id, ICardService cards, CancellationToken ct) =>
            Results.Ok(await cards.GetByIdAsync(id, ct)));

        group.MapPost("/", async (CreateCardRequest request, ICardService cards, CancellationToken ct) =>
        {
            var result = await cards.CreateAsync(request, ct);
            return Results.Created($"/api/cards/{result.Id}", result);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateCardRequest request, ICardService cards, CancellationToken ct) =>
            Results.Ok(await cards.UpdateAsync(id, request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, ICardService cards, CancellationToken ct) =>
        {
            await cards.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/publish", async (Guid id, ICardService cards, CancellationToken ct) =>
            Results.Ok(await cards.PublishAsync(id, ct)));
    }
}
