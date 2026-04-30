using System.Text.Json;
using CodeCartographer.Api.CrossLink;
using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Endpoints;

public static class GraphEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/graph").WithTags("graph");

        g.MapPost("/ingest", async (GraphPayload payload, AppDbContext db, CrossLinker linker, Guid? scanId, bool? finalize) =>
        {
            Guid id;
            Scan scan;
            if (scanId.HasValue)
            {
                id = scanId.Value;
                scan = await db.Scans.FirstAsync(s => s.Id == id);
            }
            else
            {
                scan = new Scan { Status = "running", StartedAt = DateTimeOffset.UtcNow, Label = payload.Project };
                db.Scans.Add(scan);
                await db.SaveChangesAsync();
                id = scan.Id;
            }

            // Dedupe by primary key to defend against scanner sloppiness.
            var nodesById = payload.Nodes
                .GroupBy(n => n.Id)
                .Select(gr => gr.First())
                .ToList();
            var edgesById = payload.Edges
                .GroupBy(e => e.Id)
                .Select(gr => gr.First())
                .ToList();
            var findingsById = payload.Findings
                .GroupBy(f => f.Id)
                .Select(gr => gr.First())
                .ToList();

            // Skip ids already in the database (incremental ingest).
            var existingNodeIds = await db.Nodes.Where(n => n.ScanId == id).Select(n => n.NodeId).ToListAsync();
            var existingEdgeIds = await db.Edges.Where(e => e.ScanId == id).Select(e => e.EdgeId).ToListAsync();
            var existingFindingIds = await db.Findings.Where(f => f.ScanId == id).Select(f => f.FindingId).ToListAsync();
            nodesById = nodesById.Where(n => !existingNodeIds.Contains(n.Id)).ToList();
            edgesById = edgesById.Where(e => !existingEdgeIds.Contains(e.Id)).ToList();
            findingsById = findingsById.Where(f => !existingFindingIds.Contains(f.Id)).ToList();

            db.Nodes.AddRange(nodesById.Select(n => new Db.Node
            {
                ScanId = id,
                NodeId = n.Id,
                Kind = n.Kind,
                Side = n.Side,
                Project = n.Project,
                Name = n.Name,
                FqName = n.FqName,
                FilePath = n.FilePath,
                Line = n.Line,
                Meta = JsonSerializer.Serialize(n.Meta),
                Metrics = JsonSerializer.Serialize(n.Metrics ?? new()),
            }));
            db.Edges.AddRange(edgesById.Select(e => new Db.Edge
            {
                ScanId = id,
                EdgeId = e.Id,
                SourceId = e.Source,
                TargetId = e.Target,
                Kind = e.Kind,
                Meta = JsonSerializer.Serialize(e.Meta),
            }));
            db.Findings.AddRange(findingsById.Select(f => new Db.Finding
            {
                ScanId = id,
                FindingId = f.Id,
                RuleId = f.RuleId,
                Severity = f.Severity,
                Category = f.Category,
                Title = f.Title,
                Detail = f.Detail,
                NodeId = f.NodeId,
                FilePath = f.FilePath,
                Line = f.Line,
            }));
            await db.SaveChangesAsync();

            var crossLinks = await linker.CrossLinkAsync(db, id);

            var totalNodes = await db.Nodes.CountAsync(n => n.ScanId == id);
            var totalEdges = await db.Edges.CountAsync(e => e.ScanId == id);
            var totalFindings = await db.Findings.CountAsync(f => f.ScanId == id);

            if (finalize == true)
            {
                scan.Status = "succeeded";
                scan.FinishedAt = DateTimeOffset.UtcNow;
            }
            scan.Summary = JsonSerializer.Serialize(new { nodes = totalNodes, edges = totalEdges, findings = totalFindings, crossLinks });
            await db.SaveChangesAsync();

            return Results.Ok(new IngestResponse
            {
                ScanId = id,
                NodesIngested = nodesById.Count,
                EdgesIngested = edgesById.Count,
                FindingsIngested = findingsById.Count,
                CrossLinks = crossLinks,
            });
        });

        g.MapGet("/{scanId:guid}", async (Guid scanId, AppDbContext db, string? side, string? kind, string? project) =>
        {
            var nodes = db.Nodes.Where(n => n.ScanId == scanId);
            if (!string.IsNullOrEmpty(side)) nodes = nodes.Where(n => n.Side == side);
            if (!string.IsNullOrEmpty(kind)) nodes = nodes.Where(n => n.Kind == kind);
            if (!string.IsNullOrEmpty(project)) nodes = nodes.Where(n => n.Project == project);
            var nodesList = await nodes.ToListAsync();
            var nodeIds = nodesList.Select(n => n.NodeId).ToHashSet();
            var edges = await db.Edges.Where(e => e.ScanId == scanId && nodeIds.Contains(e.SourceId) && nodeIds.Contains(e.TargetId)).ToListAsync();
            return Results.Ok(new
            {
                scanId,
                nodes = nodesList.Select(MapNode),
                edges = edges.Select(MapEdge),
            });
        });
    }

    public static object MapNode(Db.Node n) => new
    {
        id = n.NodeId,
        kind = n.Kind,
        side = n.Side,
        project = n.Project,
        name = n.Name,
        fqName = n.FqName,
        filePath = n.FilePath,
        line = n.Line,
        meta = JsonSerializer.Deserialize<JsonElement>(n.Meta),
        metrics = JsonSerializer.Deserialize<JsonElement>(n.Metrics),
    };
    public static object MapEdge(Db.Edge e) => new
    {
        id = e.EdgeId,
        source = e.SourceId,
        target = e.TargetId,
        kind = e.Kind,
        meta = JsonSerializer.Deserialize<JsonElement>(e.Meta),
    };
}
