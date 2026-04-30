using System.Text.Json;
using CodeCartographer.Api.Db;

namespace CodeCartographer.Api.Endpoints;

public static class ImportExportEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/scans/import").WithTags("import");

        g.MapPost("/", async (HttpRequest req, AppDbContext db) =>
        {
            using var sr = new StreamReader(req.Body);
            var text = await sr.ReadToEndAsync();
            using var doc = JsonDocument.Parse(text);
            var rootEl = doc.RootElement;

            var scan = new Scan
            {
                StartedAt = rootEl.TryGetProperty("startedAt", out var sa) && sa.TryGetDateTime(out var dt) ? dt : DateTimeOffset.UtcNow,
                FinishedAt = rootEl.TryGetProperty("finishedAt", out var fa) && fa.TryGetDateTime(out var dt2) ? dt2 : DateTimeOffset.UtcNow,
                Status = "imported",
                Label = (rootEl.TryGetProperty("label", out var lbl) ? lbl.GetString() : null) ?? "imported",
            };
            db.Scans.Add(scan);
            await db.SaveChangesAsync();

            if (rootEl.TryGetProperty("nodes", out var nodes))
            {
                foreach (var n in nodes.EnumerateArray())
                {
                    db.Nodes.Add(new Db.Node
                    {
                        ScanId = scan.Id,
                        NodeId = G(n, "nodeId") ?? G(n, "id") ?? "",
                        Kind = G(n, "kind") ?? "",
                        Side = G(n, "side") ?? "",
                        Project = G(n, "project") ?? "",
                        Name = G(n, "name") ?? "",
                        FqName = G(n, "fqName") ?? "",
                        FilePath = G(n, "filePath") ?? "",
                        Line = n.TryGetProperty("line", out var l) && l.ValueKind == JsonValueKind.Number ? l.GetInt32() : null,
                        Meta = n.TryGetProperty("meta", out var m) ? m.GetRawText() : "{}",
                        Metrics = "{}",
                    });
                }
            }
            if (rootEl.TryGetProperty("edges", out var edges))
            {
                foreach (var e in edges.EnumerateArray())
                {
                    db.Edges.Add(new Db.Edge
                    {
                        ScanId = scan.Id,
                        EdgeId = G(e, "edgeId") ?? G(e, "id") ?? "",
                        SourceId = G(e, "sourceId") ?? G(e, "source") ?? "",
                        TargetId = G(e, "targetId") ?? G(e, "target") ?? "",
                        Kind = G(e, "kind") ?? "",
                        Meta = "{}",
                    });
                }
            }
            if (rootEl.TryGetProperty("findings", out var findings))
            {
                foreach (var f in findings.EnumerateArray())
                {
                    db.Findings.Add(new Db.Finding
                    {
                        ScanId = scan.Id,
                        FindingId = G(f, "findingId") ?? G(f, "id") ?? "",
                        RuleId = G(f, "ruleId") ?? "",
                        Severity = G(f, "severity") ?? "info",
                        Category = G(f, "category") ?? "architecture",
                        Title = G(f, "title") ?? "",
                        Detail = G(f, "detail") ?? "",
                        NodeId = G(f, "nodeId"),
                        FilePath = G(f, "filePath"),
                        Line = f.TryGetProperty("line", out var l) && l.ValueKind == JsonValueKind.Number ? l.GetInt32() : null,
                    });
                }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { scanId = scan.Id });
        });
    }

    private static string? G(JsonElement el, string key) => el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
