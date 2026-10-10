using System.Text;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Api.Docs;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

public static class DocsEndpoints
{
    public static void MapDocsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/imports/{importId:guid}/docs", async (Guid importId, string? format, string? flowId, bool? includeAi, bool? includeEnvValues,
            GraphStore graphs, AnnotationStore annotations, AiStore ai, CancellationToken ct) =>
        {
            var import = await graphs.GetImportAsync(importId, ct);
            if (import is null)
            {
                return Results.NotFound();
            }

            var graph = await graphs.LoadGraphAsync(importId, ct);
            if (flowId is not null && graph.Find(flowId) is not { Type: NodeType.Flow })
            {
                return Results.NotFound();
            }

            var allTags = await annotations.TagsAsync(null, ct);
            var tags = allTags.GroupBy(t => t.NodeId).ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(t => t.Tag).ToList());
            var notes = new Dictionary<string, IReadOnlyList<NoteDto>>();
            foreach (var flow in graph.Nodes.Where(n => n.Type == NodeType.Flow))
            {
                notes[flow.Id] = await annotations.NotesAsync(flow.Id, ct);
            }

            var summaries = await ai.LatestSucceededAsync(graph.Nodes.Where(n => n.Type == NodeType.Flow).Select(n => n.Id).ToList(), AiKinds.FlowSummary, ct);
            var doc = DocumentationGenerator.Generate(import, graph, tags, notes, summaries,
                new DocOptions(flowId, includeAi ?? true, includeEnvValues ?? false));

            var baseName = string.Concat((flowId is null ? import.Name : graph.Find(flowId)!.Name).Select(c => char.IsLetterOrDigit(c) ? c : '_'));
            return (format ?? "md").ToLowerInvariant() switch
            {
                "html" => Results.File(Encoding.UTF8.GetBytes(doc.Html(import.Name)), "text/html; charset=utf-8", $"{baseName}.html"),
                _ => Results.File(Encoding.UTF8.GetBytes(doc.Markdown), "text/markdown; charset=utf-8", $"{baseName}.md"),
            };
        });
    }
}
