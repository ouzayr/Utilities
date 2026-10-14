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
        group.MapPost("/", async (IFormFile file, GraphStore store, AuditStore audit, CancellationToken ct) =>
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
            await audit.WriteAsync("import.create", summary.Id.ToString(), $"{summary.Kind} '{summary.Name}' {summary.Version} from {summary.FileName} (sha256 {sha})", ct);
            return Results.Created($"/api/imports/{summary.Id}", summary);
        }).DisableAntiforgery();

        group.MapGet("/", (GraphStore store, CancellationToken ct) => store.ListImportsAsync(ct));

        group.MapGet("/{id:guid}", async (Guid id, GraphStore store, CancellationToken ct) =>
            await store.GetImportAsync(id, ct) is { } import ? Results.Ok(import) : Results.NotFound());

        group.MapDelete("/{id:guid}", async (Guid id, GraphStore store, AuditStore audit, CancellationToken ct) =>
        {
            var import = await store.GetImportAsync(id, ct);
            if (import is null || !await store.DeleteImportAsync(id, ct))
            {
                return Results.NotFound();
            }

            await audit.WriteAsync("import.delete", id.ToString(), $"'{import.Name}' {import.Version}", ct);
            return Results.NoContent();
        });
    }
}
