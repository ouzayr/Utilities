using System.Text.Json;
using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.CrossLink;

/// <summary>
/// Walks UI http-call sites and matches them to API actions / endpoints.
/// Produces "http-call" edges with a confidence score.
/// </summary>
public sealed class CrossLinker
{
    public async Task<int> CrossLinkAsync(AppDbContext db, Guid scanId, CancellationToken ct = default)
    {
        var allNodes = await db.Nodes.Where(n => n.ScanId == scanId).ToListAsync(ct);
        var apiTargets = new List<(Db.Node node, string verb, string route)>();
        foreach (var n in allNodes)
        {
            if (n.Kind != "dotnet-action" && n.Kind != "dotnet-endpoint") continue;
            var meta = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(n.Meta) ?? new();
            if (!meta.TryGetValue("verb", out var verbE) || !meta.TryGetValue("route", out var routeE)) continue;
            apiTargets.Add((n, verbE.GetString() ?? "", routeE.GetString() ?? ""));
        }

        var uiCalls = new List<(Db.Node node, string verb, string url, double conf)>();
        foreach (var n in allNodes)
        {
            var meta = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(n.Meta) ?? new();
            if (!meta.TryGetValue("kindOverride", out var ko) || ko.GetString() != "http-call-site") continue;
            var verb = meta.GetValueOrDefault("verb").ValueKind == JsonValueKind.String ? meta["verb"].GetString()! : "";
            var url = meta.GetValueOrDefault("url").ValueKind == JsonValueKind.String ? meta["url"].GetString()! : "";
            var confidence = meta.GetValueOrDefault("confidence").ValueKind == JsonValueKind.Number ? meta["confidence"].GetDouble() : 0.5;
            uiCalls.Add((n, verb, url, confidence));
        }

        var edges = new List<Edge>();
        foreach (var ui in uiCalls)
        {
            var matches = apiTargets
                .Where(t => string.Equals(t.verb, ui.verb, StringComparison.OrdinalIgnoreCase))
                .Where(t => RouteMatches(ui.url, t.route))
                .OrderBy(t => Specificity(t.route))
                .ToList();
            if (matches.Count == 0) continue;
            var best = matches[0];
            edges.Add(new Edge
            {
                ScanId = scanId,
                EdgeId = $"http-call|{ui.node.NodeId}->{best.node.NodeId}",
                SourceId = ui.node.NodeId,
                TargetId = best.node.NodeId,
                Kind = "http-call",
                Meta = JsonSerializer.Serialize(new
                {
                    verb = ui.verb,
                    url = ui.url,
                    confidence = ui.conf,
                    matches = matches.Count,
                }),
            });
        }
        if (edges.Count > 0)
        {
            var existing = await db.Edges.Where(e => e.ScanId == scanId).Select(e => e.EdgeId).ToListAsync(ct);
            edges = edges.Where(e => !existing.Contains(e.EdgeId)).GroupBy(e => e.EdgeId).Select(gr => gr.First()).ToList();
            db.Edges.AddRange(edges);
            await db.SaveChangesAsync(ct);
        }
        return edges.Count;
    }

    public static bool RouteMatches(string uiUrl, string apiRoute)
    {
        var a = Normalise(uiUrl);
        var b = Normalise(apiRoute);
        var aParts = a.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var bParts = b.Split('/', StringSplitOptions.RemoveEmptyEntries);
        // Allow API to have an /api prefix the UI omits.
        if (aParts.Length == bParts.Length - 1 && bParts[0].Equals("api", StringComparison.OrdinalIgnoreCase))
        {
            bParts = bParts.Skip(1).ToArray();
        }
        if (aParts.Length == bParts.Length + 1 && aParts[0].Equals("api", StringComparison.OrdinalIgnoreCase))
        {
            aParts = aParts.Skip(1).ToArray();
        }
        if (aParts.Length != bParts.Length) return false;
        for (var i = 0; i < aParts.Length; i++)
        {
            var ap = aParts[i];
            var bp = bParts[i];
            if (ap.StartsWith(":") || bp.StartsWith(":")) continue;
            if (!string.Equals(ap, bp, StringComparison.OrdinalIgnoreCase)) return false;
        }
        return true;
    }

    private static int Specificity(string route)
    {
        return route.Split('/', StringSplitOptions.RemoveEmptyEntries).Count(p => p.StartsWith(":"));
    }

    private static string Normalise(string r)
    {
        if (string.IsNullOrEmpty(r)) return "/";
        var s = r.Trim().ToLowerInvariant();
        if (!s.StartsWith("/")) s = "/" + s;
        return s;
    }
}
