using System.Security.Cryptography;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

public static class ImportEndpoints
{
    public static void MapImportEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/imports");

        // Read-only toward customer assets: the file is parsed in memory and only our graph is stored.
        group.MapPost("/", async (IFormFile file, GraphStore store, CancellationToken ct) =>
        {
            if (file.Length == 0)
            {
                return Results.BadRequest(new { title = "Empty file." });
            }

            await using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            var sha = Convert.ToHexString(SHA256.HashData(buffer)).ToLowerInvariant();
            buffer.Position = 0;

            var result = ImportParser.Parse(buffer, file.FileName);
            var summary = await store.SaveAsync(result.Kind.ToString(), result.Name, result.Version, Path.GetFileName(file.FileName), sha, result.Graph, ct);
            return Results.Created($"/api/imports/{summary.Id}", summary);
        }).DisableAntiforgery();

        group.MapGet("/", (GraphStore store, CancellationToken ct) => store.ListImportsAsync(ct));

        group.MapGet("/{id:guid}", async (Guid id, GraphStore store, CancellationToken ct) =>
            await store.GetImportAsync(id, ct) is { } import ? Results.Ok(import) : Results.NotFound());

        group.MapDelete("/{id:guid}", async (Guid id, GraphStore store, CancellationToken ct) =>
            await store.DeleteImportAsync(id, ct) ? Results.NoContent() : Results.NotFound());
    }
}
