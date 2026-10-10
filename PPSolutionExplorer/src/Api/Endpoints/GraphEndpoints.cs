using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Paths;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Core.Search;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

public sealed record PathRequest(string FlowId, string? FromNodeId, string? ToNodeId, bool? IncludeFailureBranches, int? MaxPaths);

public static class GraphEndpoints
{
    public const int MaxPathCap = 100_000;

    public static void MapGraphEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/imports/{importId:guid}");

        group.MapGet("/nodes", (Guid importId, NodeType type, GraphStore store, CancellationToken ct) =>
            store.ListNodesAsync(importId, type, ct));

        // Node IDs contain ':' and '/', so they travel as a query parameter.
        group.MapGet("/node", async (Guid importId, string nodeId, GraphStore graph, AnnotationStore annotations, AiStore ai, CancellationToken ct) =>
        {
            var node = await graph.GetNodeAsync(importId, nodeId, ct);
            if (node is null)
            {
                return Results.NotFound();
            }

            var (outgoing, incoming, unresolved) = await graph.GetNodeLinksAsync(importId, nodeId, ct);
            return Results.Ok(new
            {
                node = new
                {
                    node.Id,
                    Type = Enum.Parse<NodeType>(node.Type),
                    node.Name,
                    node.ParentId,
                    node.Branch,
                    node.SubType,
                    node.Connector,
                    node.Operation,
                    node.Properties,
                    node.RawJson,
                    FlowId = GraphStore.FlowIdOf(node.Id),
                },
                outgoing = outgoing.Select(e => new { e.SourceId, e.TargetId, e.Type, Status = (RunStatus)e.Status, e.Expression }),
                incoming = incoming.Select(e => new { e.SourceId, e.TargetId, e.Type, Status = (RunStatus)e.Status, e.Expression }),
                unresolved = unresolved.Select(u => new { u.RawExpression, u.Reason }),
                tags = await annotations.TagsAsync(nodeId, ct),
                notes = await annotations.NotesAsync(nodeId, ct),
                ai = await ai.LatestForNodeAsync(nodeId, ct),
            });
        });

        group.MapGet("/flow-graph", async (Guid importId, string flowId, GraphStore store, CancellationToken ct) =>
        {
            var graph = await store.LoadFlowGraphAsync(importId, flowId, ct);
            if (graph is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new
            {
                nodes = graph.Nodes.OrderBy(n => n.Order).Select(n => new
                {
                    n.Id, n.Type, n.Name, n.ParentId, n.Branch, n.SubType, n.IsPlaceholder,
                    InFlow = n.Id == flowId || n.Id.StartsWith(flowId + "/", StringComparison.Ordinal),
                }),
                edges = graph.Edges.Select(e => new { e.SourceId, e.TargetId, e.Type, e.Status, e.Expression }),
                unresolved = graph.Unresolved,
            });
        });

        group.MapPost("/paths", async (Guid importId, PathRequest request, GraphStore store, CancellationToken ct) =>
        {
            var graph = await store.LoadFlowGraphAsync(importId, request.FlowId, ct);
            if (graph is null)
            {
                return Results.NotFound();
            }

            foreach (var id in new[] { request.FromNodeId, request.ToNodeId }.OfType<string>())
            {
                if (graph.Find(id) is not { } n || !n.Type.IsFlowStep())
                {
                    return Results.BadRequest(new { title = $"'{id}' is not a step of this flow." });
                }
            }

            var result = PathTracer.Trace(graph, new PathTraceRequest(
                request.FlowId,
                request.FromNodeId,
                request.ToNodeId,
                request.IncludeFailureBranches ?? true,
                Math.Clamp(request.MaxPaths ?? PathTraceRequest.DefaultMaxPaths, 1, MaxPathCap)));

            var names = result.Paths.SelectMany(p => p.Steps).Select(s => s.NodeId).Distinct()
                .ToDictionary(id => id, id => graph.Find(id)?.Name ?? id);

            return Results.Ok(new
            {
                total_estimated = result.TotalEstimated,
                returned = result.Returned,
                truncated = result.Truncated,
                result.Paths,
                result.Warnings,
                names,
            });
        });

        group.MapGet("/impact", (Guid importId, string nodeId, int? depth, GraphStore store, CancellationToken ct) =>
            store.ImpactAsync(importId, nodeId, depth ?? 6, ct));

        group.MapGet("/quality", async (Guid importId, string flowId, GraphStore store, CancellationToken ct) =>
        {
            var graph = await store.LoadFlowGraphAsync(importId, flowId, ct);
            return graph is null ? Results.NotFound() : Results.Ok(QualityRules.Evaluate(graph, flowId));
        });

        group.MapGet("/facets", (Guid importId, GraphStore store, CancellationToken ct) => store.GetFacetsAsync(importId, ct));

        api.MapPost("/search", async (SearchQuery query, GraphStore store, CancellationToken ct) =>
        {
            var facets = await store.GetFacetsAsync(query.ImportId, ct);
            var (sanitised, dropped) = facets.Sanitise(query);
            return Results.Ok(new { query = sanitised, dropped, results = await store.SearchAsync(sanitised, ct) });
        });
    }
}
