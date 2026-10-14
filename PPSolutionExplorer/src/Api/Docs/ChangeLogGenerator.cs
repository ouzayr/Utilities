using PPSolutionExplorer.Core.Diff;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Docs;

/// <summary>Change log (or drift report) between two imports, from <see cref="GraphDiffer"/>. Fully deterministic.</summary>
public static class ChangeLogGenerator
{
    internal static DocWriter Generate(ImportSummary left, ImportSummary right, ComponentGraph leftGraph, ComponentGraph rightGraph, GraphDiff diff, string? flowId)
    {
        var doc = new DocWriter();
        doc.Heading(1, $"Changes: {left.Name} {left.Version} → {right.Name} {right.Version}");
        doc.Paragraph($"Baseline '{left.FileName}' (imported {left.ImportedAt:yyyy-MM-dd HH:mm} UTC) compared with '{right.FileName}' " +
                      $"(imported {right.ImportedAt:yyyy-MM-dd HH:mm} UTC). Components are matched by ID; a renamed step appears as removed + added. " +
                      "Use the same report for drift between environments by importing an export from each.", muted: true);

        var s = diff.Summary;
        doc.Table(["Added", "Removed", "Changed", "Moved", "Link changes"],
            [[s.Added.ToString(), s.Removed.ToString(), s.Changed.ToString(), s.Moved.ToString(), s.EdgesChanged.ToString()]]);

        if (s.IsEmpty)
        {
            doc.Paragraph("No differences.");
            return doc;
        }

        var nonFlow = diff.Nodes.Where(n => n.FlowId is null).ToList();
        if (nonFlow.Count > 0)
        {
            doc.Heading(2, "Solution components");
            doc.Table(["Change", "Type", "Component", "Details"], nonFlow.Select(n => (IReadOnlyList<string>)
                [n.Kind.ToString(), n.Type.ToString(), n.Name, Details(n)]));
        }

        foreach (var group in diff.Nodes.Where(n => n.FlowId is not null).GroupBy(n => n.FlowId!).OrderBy(g => g.Key, StringComparer.Ordinal))
        {
            var name = rightGraph.Find(group.Key)?.Name ?? leftGraph.Find(group.Key)?.Name ?? group.Key;
            doc.Heading(2, $"Flow: {name}");
            doc.Table(["Change", "Step", "Type", "Details"], group.Select(n => (IReadOnlyList<string>)
                [n.Kind.ToString(), n.Name, n.Type.ToString(), Details(n)]));

            var edges = diff.Edges.Where(e => e.SourceId.StartsWith(group.Key, StringComparison.Ordinal) || e.TargetId.StartsWith(group.Key, StringComparison.Ordinal))
                .Where(e => e.Type != EdgeType.DataFlow).ToList();
            if (edges.Count > 0)
            {
                doc.Heading(3, "Link changes");
                doc.Table(["Change", "From", "Link", "To", "Before", "After"], edges.Select(e => (IReadOnlyList<string>)
                [
                    e.Kind.ToString(), NameOf(e.SourceId), e.Type.ToString(), NameOf(e.TargetId), e.Before ?? "-", e.After ?? "-",
                ]));
            }
        }

        return doc;

        string NameOf(string id) => rightGraph.Find(id)?.Name ?? leftGraph.Find(id)?.Name ?? id;
    }

    private static string Details(NodeChange change) =>
        change.Changes.Count == 0 ? "" : string.Join("; ", change.Changes.Take(8).Select(c => $"{c.Path}: {c.Before ?? "∅"} → {c.After ?? "∅"}"))
            + (change.Changes.Count > 8 ? $"; … {change.Changes.Count - 8} more" : "");
}
