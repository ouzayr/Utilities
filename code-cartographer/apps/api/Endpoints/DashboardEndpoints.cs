using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Endpoints;

public static class DashboardEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/dashboard").WithTags("dashboard");

        g.MapGet("/{scanId:guid}", async (Guid scanId, AppDbContext db) =>
        {
            var nodes = await db.Nodes.Where(n => n.ScanId == scanId).Select(n => new { n.Side, n.Kind, n.Project }).ToListAsync();
            var edges = await db.Edges.Where(e => e.ScanId == scanId).Select(e => new { e.Kind, e.SourceId, e.TargetId }).ToListAsync();
            var findings = await db.Findings.Where(f => f.ScanId == scanId).ToListAsync();

            var byKind = nodes.GroupBy(n => n.Kind).Select(gr => new { kind = gr.Key, count = gr.Count() }).OrderByDescending(x => x.count).ToList();
            var byProject = nodes.GroupBy(n => n.Project).Select(gr => new { project = gr.Key, count = gr.Count() }).OrderByDescending(x => x.count).ToList();
            var bySeverity = findings.GroupBy(f => f.Severity).ToDictionary(gr => gr.Key, gr => gr.Count());
            var byCategory = findings.GroupBy(f => f.Category).ToDictionary(gr => gr.Key, gr => gr.Count());

            var apiActions = nodes.Where(n => n.Kind == "dotnet-action" || n.Kind == "dotnet-endpoint").ToList();
            var httpEdges = edges.Where(e => e.Kind == "http-call").ToList();
            var calledTargets = httpEdges.Select(e => e.TargetId).ToHashSet();
            var orphanEndpoints = apiActions.Count - calledTargets.Count;

            var uiComponents = nodes.Count(n => n.Kind == "ng-component");
            var uiServices = nodes.Count(n => n.Kind == "ng-service");

            return Results.Ok(new
            {
                totals = new { nodes = nodes.Count, edges = edges.Count, findings = findings.Count },
                kpis = new
                {
                    apiActions = apiActions.Count,
                    orphanEndpoints,
                    uiComponents,
                    uiServices,
                    crossLinks = httpEdges.Count,
                },
                byKind,
                byProject,
                bySeverity,
                byCategory,
            });
        });

        g.MapGet("/trends", async (int? limit, AppDbContext db) =>
        {
            var take = limit ?? 20;
            var scans = await db.Scans.OrderByDescending(s => s.StartedAt).Take(take).ToListAsync();
            scans.Reverse();
            var rows = new List<object>();
            foreach (var s in scans)
            {
                var nodeCount = await db.Nodes.CountAsync(n => n.ScanId == s.Id);
                var edgeCount = await db.Edges.CountAsync(e => e.ScanId == s.Id);
                var findingCount = await db.Findings.CountAsync(f => f.ScanId == s.Id);
                rows.Add(new
                {
                    scanId = s.Id,
                    startedAt = s.StartedAt,
                    label = s.Label,
                    nodes = nodeCount,
                    edges = edgeCount,
                    findings = findingCount,
                });
            }
            return Results.Ok(rows);
        });
    }
}
