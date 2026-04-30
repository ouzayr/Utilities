using CodeCartographer.Api.Db;
using CodeCartographer.Api.Flow;

namespace CodeCartographer.Api.Endpoints;

public static class FlowEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/flows").WithTags("flows");

        g.MapGet("/from", async (Guid scanId, string nodeId, string? direction, int? maxDepth, AppDbContext db, FlowEngine engine) =>
        {
            var (nodes, edges) = await engine.TraverseAsync(db, scanId, nodeId, direction ?? "both", maxDepth ?? 6);
            return Results.Ok(new
            {
                nodes = nodes.Select(GraphEndpoints.MapNode),
                edges = edges.Select(GraphEndpoints.MapEdge),
            });
        });
    }
}
