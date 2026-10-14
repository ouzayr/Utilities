using System.Text;
using PPSolutionExplorer.Api.Docs;
using PPSolutionExplorer.Core.Diff;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

/// <summary>Version comparison and environment drift: both are a diff between two imports.</summary>
public static class DiffEndpoints
{
    public static void MapDiffEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/diff", async (Guid left, Guid right, string? flowId, string? format, GraphStore store, CancellationToken ct) =>
        {
            var leftImport = await store.GetImportAsync(left, ct);
            var rightImport = await store.GetImportAsync(right, ct);
            if (leftImport is null || rightImport is null)
            {
                return Results.NotFound();
            }

            var leftGraph = await store.LoadGraphAsync(left, ct);
            var rightGraph = await store.LoadGraphAsync(right, ct);
            var diff = GraphDiffer.Diff(leftGraph, rightGraph, flowId);

            switch ((format ?? "json").ToLowerInvariant())
            {
                case "md" or "html":
                    var doc = ChangeLogGenerator.Generate(leftImport, rightImport, leftGraph, rightGraph, diff, flowId);
                    var html = format!.Equals("html", StringComparison.OrdinalIgnoreCase);
                    var bytes = Encoding.UTF8.GetBytes(html ? doc.Html($"Changes {rightImport.Name}") : doc.Markdown);
                    return Results.File(bytes, html ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
                        $"changes_{Safe(rightImport.Name)}.{(html ? "html" : "md")}");
                default:
                    var flowNames = diff.Nodes.Select(n => n.FlowId).OfType<string>().Distinct()
                        .ToDictionary(id => id, id => rightGraph.Find(id)?.Name ?? leftGraph.Find(id)?.Name ?? id);
                    return Results.Ok(new { left = leftImport, right = rightImport, summary = diff.Summary, diff.Nodes, diff.Edges, flowNames });
            }
        });
    }

    private static string Safe(string name) => string.Concat(name.Select(c => char.IsLetterOrDigit(c) ? c : '_'));
}
