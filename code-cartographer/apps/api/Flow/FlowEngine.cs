using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Flow;

public sealed class FlowEngine
{
    public async Task<(List<Db.Node>, List<Db.Edge>)> TraverseAsync(AppDbContext db, Guid scanId, string nodeId, string direction, int maxDepth = 6)
    {
        var allNodes = await db.Nodes.Where(n => n.ScanId == scanId).ToListAsync();
        var allEdges = await db.Edges.Where(e => e.ScanId == scanId).ToListAsync();
        var byId = allNodes.ToDictionary(n => n.NodeId);
        var visited = new HashSet<string>();
        var queue = new Queue<(string id, int depth)>();
        queue.Enqueue((nodeId, 0));
        var collectedEdges = new List<Db.Edge>();
        while (queue.TryDequeue(out var item))
        {
            if (!visited.Add(item.id)) continue;
            if (item.depth >= maxDepth) continue;
            IEnumerable<Db.Edge> next = direction switch
            {
                "downstream" => allEdges.Where(e => e.SourceId == item.id),
                "upstream" => allEdges.Where(e => e.TargetId == item.id),
                _ => allEdges.Where(e => e.SourceId == item.id || e.TargetId == item.id),
            };
            foreach (var e in next)
            {
                collectedEdges.Add(e);
                var other = e.SourceId == item.id ? e.TargetId : e.SourceId;
                if (!visited.Contains(other)) queue.Enqueue((other, item.depth + 1));
            }
        }
        var nodes = visited.Where(byId.ContainsKey).Select(id => byId[id]).ToList();
        return (nodes, collectedEdges.DistinctBy(e => e.EdgeId).ToList());
    }
}
