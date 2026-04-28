using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Endpoints;

public static class ScanEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/scans").WithTags("scans");

        g.MapGet("/", async (AppDbContext db) =>
        {
            var scans = await db.Scans.OrderByDescending(s => s.StartedAt).Take(200).ToListAsync();
            return Results.Ok(scans.Select(s => new
            {
                id = s.Id,
                status = s.Status,
                startedAt = s.StartedAt,
                finishedAt = s.FinishedAt,
                label = s.Label,
                summary = System.Text.Json.JsonDocument.Parse(s.Summary).RootElement,
                error = s.Error,
            }));
        });

        g.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var scan = await db.Scans.FindAsync(id);
            if (scan is null) return Results.NotFound();
            var nodeCount = await db.Nodes.CountAsync(n => n.ScanId == id);
            var edgeCount = await db.Edges.CountAsync(e => e.ScanId == id);
            var findingCount = await db.Findings.CountAsync(f => f.ScanId == id);
            return Results.Ok(new { scan, nodeCount, edgeCount, findingCount });
        });

        g.MapPost("/", async (StartScanRequest req, AppDbContext db) =>
        {
            var scan = new Scan
            {
                Status = "running",
                StartedAt = DateTimeOffset.UtcNow,
                Label = req.Label ?? $"scan-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                RepoIds = req.RepoIds ?? Array.Empty<Guid>(),
            };
            db.Scans.Add(scan);
            await db.SaveChangesAsync();
            return Results.Ok(new { scanId = scan.Id });
        });

        g.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var scan = await db.Scans.FindAsync(id);
            if (scan is null) return Results.NotFound();
            db.Scans.Remove(scan);
            // children are CASCADE on the FK, but we don't have an FK declared, so wipe manually.
            await db.Nodes.Where(n => n.ScanId == id).ExecuteDeleteAsync();
            await db.Edges.Where(e => e.ScanId == id).ExecuteDeleteAsync();
            await db.Findings.Where(f => f.ScanId == id).ExecuteDeleteAsync();
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapGet("/{id:guid}/findings", async (Guid id, AppDbContext db, string? severity, string? category) =>
        {
            var q = db.Findings.Where(f => f.ScanId == id);
            if (!string.IsNullOrEmpty(severity)) q = q.Where(f => f.Severity == severity);
            if (!string.IsNullOrEmpty(category)) q = q.Where(f => f.Category == category);
            var list = await q.ToListAsync();
            return Results.Ok(list.Select(f => new
            {
                id = f.FindingId,
                ruleId = f.RuleId,
                severity = f.Severity,
                category = f.Category,
                title = f.Title,
                detail = f.Detail,
                nodeId = f.NodeId,
                filePath = f.FilePath,
                line = f.Line,
            }));
        });

        g.MapGet("/{id:guid}/projects", async (Guid id, AppDbContext db) =>
        {
            var projects = await db.Nodes.Where(n => n.ScanId == id)
                .GroupBy(n => new { n.Side, n.Project })
                .Select(gr => new { gr.Key.Side, gr.Key.Project, count = gr.Count() })
                .ToListAsync();
            return Results.Ok(projects);
        });
    }
}

public sealed record StartScanRequest(Guid[]? RepoIds, string? Label);
