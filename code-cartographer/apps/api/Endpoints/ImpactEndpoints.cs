using CodeCartographer.Api.Db;
using CodeCartographer.Api.Flow;

namespace CodeCartographer.Api.Endpoints;

public static class ImpactEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/impact").WithTags("impact");

        g.MapGet("/", async (Guid scanId, string nodeId, AppDbContext db, FlowEngine engine) =>
        {
            // upstream traversal == "who depends on me"
            var (nodes, edges) = await engine.TraverseAsync(db, scanId, nodeId, "upstream", 12);
            // partition by side and group by kind for a quick summary.
            var summary = nodes
                .GroupBy(n => new { n.Side, n.Kind })
                .Select(gr => new { gr.Key.Side, gr.Key.Kind, count = gr.Count() })
                .OrderByDescending(x => x.count)
                .ToList();
            return Results.Ok(new
            {
                root = nodeId,
                impactedCount = nodes.Count,
                summary,
                nodes = nodes.Select(GraphEndpoints.MapNode),
                edges = edges.Select(GraphEndpoints.MapEdge),
            });
        });
    }
}
