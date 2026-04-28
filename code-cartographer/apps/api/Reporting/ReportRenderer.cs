using System.Text;
using System.Text.Json;
using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Reporting;

public sealed class ReportRenderer
{
    public async Task<(byte[] bytes, string contentType, string fileName)> RenderAsync(AppDbContext db, Guid scanId, string format)
    {
        var scan = await db.Scans.FindAsync(scanId) ?? throw new InvalidOperationException("scan not found");
        var nodes = await db.Nodes.Where(n => n.ScanId == scanId).ToListAsync();
        var edges = await db.Edges.Where(e => e.ScanId == scanId).ToListAsync();
        var findings = await db.Findings.Where(f => f.ScanId == scanId).OrderBy(f => f.Severity).ToListAsync();

        return format.ToLowerInvariant() switch
        {
            "json" => RenderJson(scan, nodes, edges, findings),
            "md" or "markdown" => RenderMarkdown(scan, nodes, edges, findings),
            "html" => RenderHtml(scan, nodes, edges, findings),
            _ => throw new InvalidOperationException($"unsupported format: {format} (use json, md, html)"),
        };
    }

    private static (byte[], string, string) RenderJson(Scan scan, List<Db.Node> nodes, List<Db.Edge> edges, List<Db.Finding> findings)
    {
        var doc = new
        {
            schemaVersion = 1,
            scanId = scan.Id,
            startedAt = scan.StartedAt,
            finishedAt = scan.FinishedAt,
            label = scan.Label,
            nodes = nodes.Select(n => new { n.NodeId, n.Kind, n.Side, n.Project, n.Name, n.FqName, n.FilePath, n.Line, meta = JsonDocument.Parse(n.Meta).RootElement }),
            edges = edges.Select(e => new { e.EdgeId, e.SourceId, e.TargetId, e.Kind }),
            findings = findings.Select(f => new { f.FindingId, f.RuleId, f.Severity, f.Category, f.Title, f.Detail, f.NodeId, f.FilePath, f.Line }),
        };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(doc, new JsonSerializerOptions { WriteIndented = true });
        return (bytes, "application/json", $"scan-{scan.Id:N}.json");
    }

    private static (byte[], string, string) RenderMarkdown(Scan scan, List<Db.Node> nodes, List<Db.Edge> edges, List<Db.Finding> findings)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"# Scan {scan.Id}");
        sb.AppendLine();
        sb.AppendLine($"- Label: **{scan.Label ?? "—"}**");
        sb.AppendLine($"- Started: {scan.StartedAt:u}");
        sb.AppendLine($"- Finished: {scan.FinishedAt:u}");
        sb.AppendLine($"- Status: {scan.Status}");
        sb.AppendLine();
        sb.AppendLine("## Totals");
        sb.AppendLine($"- Nodes: **{nodes.Count}**");
        sb.AppendLine($"- Edges: **{edges.Count}**");
        sb.AppendLine($"- Findings: **{findings.Count}**");
        sb.AppendLine();
        sb.AppendLine("## Nodes by kind");
        sb.AppendLine();
        sb.AppendLine("| Kind | Count |");
        sb.AppendLine("|---|---:|");
        foreach (var gr in nodes.GroupBy(n => n.Kind).OrderByDescending(g => g.Count()))
        {
            sb.AppendLine($"| {gr.Key} | {gr.Count()} |");
        }
        sb.AppendLine();
        sb.AppendLine("## Findings");
        sb.AppendLine();
        sb.AppendLine("| Severity | Category | Rule | Title | File |");
        sb.AppendLine("|---|---|---|---|---|");
        foreach (var f in findings)
        {
            sb.AppendLine($"| {f.Severity} | {f.Category} | `{f.RuleId}` | {f.Title} | `{f.FilePath ?? "—"}:{f.Line?.ToString() ?? "?"}` |");
        }
        return (Encoding.UTF8.GetBytes(sb.ToString()), "text/markdown; charset=utf-8", $"scan-{scan.Id:N}.md");
    }

    private static (byte[], string, string) RenderHtml(Scan scan, List<Db.Node> nodes, List<Db.Edge> edges, List<Db.Finding> findings)
    {
        var (mdBytes, _, _) = RenderMarkdown(scan, nodes, edges, findings);
        var md = Encoding.UTF8.GetString(mdBytes);
        // Minimal Markdown → HTML (headings, tables, lists). No JS, no external assets.
        var css = "body{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#1f2328}"
            + "table{border-collapse:collapse;width:100%;margin:1rem 0}"
            + "th,td{border:1px solid #d0d7de;padding:6px 10px;text-align:left}"
            + "th{background:#f6f8fa}"
            + "code{background:#f6f8fa;padding:2px 4px;border-radius:4px}"
            + "h1,h2{border-bottom:1px solid #d0d7de;padding-bottom:0.3em}";
        var html = "<!doctype html><html><head><meta charset=\"utf-8\" /><title>code-cartographer scan "
            + System.Net.WebUtility.HtmlEncode(scan.Id.ToString()) + "</title><style>" + css + "</style></head><body>"
            + SimpleMarkdownToHtml(md)
            + "</body></html>";
        return (Encoding.UTF8.GetBytes(html), "text/html; charset=utf-8", $"scan-{scan.Id:N}.html");
    }

    private static string SimpleMarkdownToHtml(string md)
    {
        var sb = new StringBuilder();
        var lines = md.Split('\n');
        var inTable = false;
        foreach (var raw in lines)
        {
            var line = raw.TrimEnd('\r');
            if (line.StartsWith("# ")) { sb.AppendLine($"<h1>{Esc(line[2..])}</h1>"); continue; }
            if (line.StartsWith("## ")) { sb.AppendLine($"<h2>{Esc(line[3..])}</h2>"); continue; }
            if (line.StartsWith("- "))
            {
                sb.AppendLine($"<p>• {Esc(line[2..])}</p>");
                continue;
            }
            if (line.StartsWith("|"))
            {
                if (!inTable) { sb.AppendLine("<table>"); inTable = true; }
                if (line.Contains("---")) continue;
                var cells = line.Trim('|').Split('|').Select(c => c.Trim()).ToArray();
                sb.AppendLine("<tr>" + string.Concat(cells.Select(c => $"<td>{Esc(c)}</td>")) + "</tr>");
                continue;
            }
            if (inTable) { sb.AppendLine("</table>"); inTable = false; }
            if (string.IsNullOrWhiteSpace(line)) sb.AppendLine();
            else sb.AppendLine($"<p>{Esc(line)}</p>");
        }
        if (inTable) sb.AppendLine("</table>");
        return sb.ToString();
    }

    private static string Esc(string s) => System.Net.WebUtility.HtmlEncode(s);
}
