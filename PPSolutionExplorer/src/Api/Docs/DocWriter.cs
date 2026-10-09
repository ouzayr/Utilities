using System.Net;
using System.Text;

namespace PPSolutionExplorer.Api.Docs;

/// <summary>Writes the same document as Markdown and HTML.</summary>
internal sealed class DocWriter
{
    private readonly StringBuilder _md = new();
    private readonly StringBuilder _html = new();

    public string Markdown => _md.ToString();

    public string Html(string title) => $$"""
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{E(title)}}</title>
        <style>
        body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#1f2328;line-height:1.5}
        h1,h2,h3{line-height:1.25}h2{border-bottom:1px solid #d0d7de;padding-bottom:.3rem;margin-top:2.5rem}
        table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.92rem}th,td{border:1px solid #d0d7de;padding:.35rem .6rem;text-align:left;vertical-align:top}
        th{background:#f6f8fa}code{background:#f6f8fa;padding:.1rem .3rem;border-radius:4px;font-size:.88em}
        ul.tree{list-style:none;padding-left:1.1rem;border-left:1px dashed #d0d7de}
        .ai{border:2px dashed #8250df;background:#fbf8ff;padding:.75rem 1rem;border-radius:6px;margin:1rem 0}
        .ai-label{font-size:.8rem;font-weight:600;color:#8250df;text-transform:uppercase;letter-spacing:.04em}
        .muted{color:#59636e;font-size:.9rem}
        </style></head><body>
        {{_html}}
        </body></html>
        """;

    public void Heading(int level, string text)
    {
        _md.AppendLine().Append(new string('#', level)).Append(' ').AppendLine(text).AppendLine();
        _html.Append($"<h{level}>{E(text)}</h{level}>\n");
    }

    public void Paragraph(string text, bool muted = false)
    {
        _md.AppendLine(muted ? $"_{text}_" : text).AppendLine();
        _html.Append(muted ? $"<p class=\"muted\">{E(text)}</p>\n" : $"<p>{E(text)}</p>\n");
    }

    public void List(IEnumerable<string> items)
    {
        var list = items.ToList();
        if (list.Count == 0)
        {
            return;
        }

        foreach (var item in list)
        {
            _md.Append("- ").AppendLine(item);
        }

        _md.AppendLine();
        _html.Append("<ul>").Append(string.Concat(list.Select(i => $"<li>{E(i)}</li>"))).Append("</ul>\n");
    }

    /// <summary>Indented tree: each item is (depth, text).</summary>
    public void Tree(IEnumerable<(int Depth, string Text)> items)
    {
        var list = items.ToList();
        foreach (var (depth, text) in list)
        {
            _md.Append(new string(' ', depth * 2)).Append("- ").AppendLine(text);
        }

        _md.AppendLine();

        var current = -1;
        foreach (var (depth, text) in list)
        {
            while (current < depth)
            {
                _html.Append("<ul class=\"tree\">");
                current++;
            }

            while (current > depth)
            {
                _html.Append("</ul>");
                current--;
            }

            _html.Append($"<li>{E(text)}</li>");
        }

        while (current >= 0)
        {
            _html.Append("</ul>");
            current--;
        }

        _html.Append('\n');
    }

    public void Table(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<string>> rows)
    {
        var data = rows.ToList();
        if (data.Count == 0)
        {
            Paragraph("None.", muted: true);
            return;
        }

        _md.Append("| ").AppendJoin(" | ", headers.Select(Md)).AppendLine(" |");
        _md.Append('|').AppendJoin('|', headers.Select(_ => "---")).AppendLine("|");
        foreach (var row in data)
        {
            _md.Append("| ").AppendJoin(" | ", row.Select(Md)).AppendLine(" |");
        }

        _md.AppendLine();
        _html.Append("<table><thead><tr>").Append(string.Concat(headers.Select(h => $"<th>{E(h)}</th>"))).Append("</tr></thead><tbody>");
        foreach (var row in data)
        {
            _html.Append("<tr>").Append(string.Concat(row.Select(c => $"<td>{E(c)}</td>"))).Append("</tr>");
        }

        _html.Append("</tbody></table>\n");
    }

    /// <summary>AI content, visually distinct and labelled with model, prompt version and timestamp.</summary>
    public void AiBlock(string label, IEnumerable<string> lines)
    {
        var list = lines.ToList();
        _md.AppendLine($"> **AI-generated** — {label}. Verify before relying on it.").AppendLine(">");
        foreach (var line in list)
        {
            _md.Append("> ").AppendLine(line);
        }

        _md.AppendLine();
        _html.Append($"<div class=\"ai\"><div class=\"ai-label\">AI-generated — {E(label)}. Verify before relying on it.</div>");
        _html.Append(string.Concat(list.Select(l => $"<p>{E(l)}</p>"))).Append("</div>\n");
    }

    private static string E(string text) => WebUtility.HtmlEncode(text);

    private static string Md(string text) => text.Replace("|", "\\|").ReplaceLineEndings(" ");
}
