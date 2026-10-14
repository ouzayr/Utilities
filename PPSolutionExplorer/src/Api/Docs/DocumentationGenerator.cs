using System.Text.Json.Nodes;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Docs;

public sealed record DocOptions(string? FlowId, bool IncludeAi, bool IncludeEnvValues);

/// <summary>Generates documentation from the graph. Deterministic, except for clearly labelled AI blocks.</summary>
public static class DocumentationGenerator
{
    internal static DocWriter Generate(
        ImportSummary import,
        ComponentGraph graph,
        IReadOnlyDictionary<string, IReadOnlyList<string>> tags,
        IReadOnlyDictionary<string, IReadOnlyList<NoteDto>> notes,
        IReadOnlyDictionary<string, AiOutputRecord> summaries,
        DocOptions options)
    {
        var doc = new DocWriter();
        doc.Heading(1, $"{import.Name} — technical documentation");
        doc.Paragraph($"Generated {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC by PP Solution Explorer from '{import.FileName}' (imported {import.ImportedAt:yyyy-MM-dd HH:mm} UTC). " +
                      "Content is derived from the export by deterministic parsing; AI-generated sections are marked.", muted: true);

        var flows = graph.Nodes.Where(n => n.Type == NodeType.Flow && !n.IsPlaceholder)
            .Where(n => options.FlowId is null || n.Id == options.FlowId)
            .OrderBy(n => n.Name).ToList();

        if (options.FlowId is null)
        {
            doc.Heading(2, "Overview");
            doc.Table(["Property", "Value"],
            [
                ["Kind", import.Kind],
                ["Version", import.Version ?? "-"],
                ["Cloud flows", flows.Count.ToString()],
                ["Tables", graph.Nodes.Count(n => n.Type == NodeType.Table).ToString()],
                ["Environment variables", graph.Nodes.Count(n => n.Type == NodeType.EnvVariable).ToString()],
                ["Connection references", graph.Nodes.Count(n => n.Type == NodeType.ConnectionReference).ToString()],
                ["Unresolved references", graph.Unresolved.Count.ToString()],
            ]);

            if (import.Warnings.Count > 0)
            {
                doc.Heading(3, "Import warnings");
                doc.List(import.Warnings);
            }

            doc.Heading(2, "Cloud flows");
            doc.Table(["Flow", "State", "Trigger", "Steps", "Unresolved"], flows.Select(f =>
            {
                var steps = graph.Descendants(f.Id).Where(n => n.Type.IsFlowStep()).ToList();
                var trigger = steps.FirstOrDefault(s => s.Type == NodeType.Trigger);
                IReadOnlyList<string> row =
                [
                    f.Name,
                    f.Property(NodeProperties.State) ?? "-",
                    trigger is null ? "-" : $"{trigger.Name} ({trigger.SubType})",
                    steps.Count(s => s.Type != NodeType.Trigger).ToString(),
                    graph.Unresolved.Count(u => u.NodeId.StartsWith(f.Id + "/", StringComparison.Ordinal)).ToString(),
                ];
                return row;
            }));
        }

        foreach (var flow in flows)
        {
            WriteFlow(doc, graph, flow, tags, notes, summaries, options);
        }

        if (options.FlowId is null)
        {
            WriteSolutionComponents(doc, graph, options);
        }

        return doc;
    }

    private static void WriteFlow(DocWriter doc, ComponentGraph graph, GraphNode flow,
        IReadOnlyDictionary<string, IReadOnlyList<string>> tags,
        IReadOnlyDictionary<string, IReadOnlyList<NoteDto>> notes,
        IReadOnlyDictionary<string, AiOutputRecord> summaries,
        DocOptions options)
    {
        doc.Heading(2, $"Flow: {flow.Name}");
        doc.Paragraph($"ID: {flow.Id} · State: {flow.Property(NodeProperties.State) ?? "-"}", muted: true);

        if (tags.TryGetValue(flow.Id, out var flowTags) && flowTags.Count > 0)
        {
            doc.Paragraph("Tags: " + string.Join(", ", flowTags));
        }

        if (options.IncludeAi && summaries.TryGetValue(flow.Id, out var summary) && summary.Content is not null)
        {
            var json = JsonNode.Parse(summary.Content);
            var lines = new List<string>();
            if (json?["purpose"]?.GetValue<string>() is { } purpose)
            {
                lines.Add("Purpose: " + purpose);
            }

            if (json?["summary"]?.GetValue<string>() is { } text)
            {
                lines.Add(text);
            }

            lines.AddRange((json?["keySteps"]?.AsArray() ?? []).Select((s, i) => $"{i + 1}. {s}"));
            lines.AddRange((json?["risks"]?.AsArray() ?? []).Select(r => $"Risk: {r}"));
            doc.AiBlock($"model {summary.Model}, prompt {summary.PromptName} v{summary.PromptVersion}, {summary.CreatedAt:yyyy-MM-dd HH:mm} UTC", lines);
        }

        if (notes.TryGetValue(flow.Id, out var flowNotes) && flowNotes.Count > 0)
        {
            doc.Heading(3, "Notes");
            doc.List(flowNotes.Select(n => n.Text));
        }

        doc.Heading(3, "Steps");
        doc.Tree(StepTree(graph, flow.Id, 0, tags));

        var steps = graph.Descendants(flow.Id).Where(n => n.Type.IsFlowStep()).Select(n => n.Id).Append(flow.Id).ToHashSet();
        var data = graph.Edges.Where(e => steps.Contains(e.SourceId) && e.Type is EdgeType.Reads or EdgeType.Writes)
            .Select(e => (Step: graph.Find(e.SourceId)?.Name ?? e.SourceId, Access: e.Type.ToString(), Target: e.TargetId))
            .OrderBy(x => x.Target).ThenBy(x => x.Step).ToList();
        doc.Heading(3, "Data access");
        doc.Table(["Table / column", "Access", "Step"], data.Select(d => (IReadOnlyList<string>)[d.Target, d.Access, d.Step]));

        doc.Heading(3, "Dependencies");
        var dependencies = graph.Outgoing(flow.Id)
            .Where(e => e.Type is EdgeType.UsesConnection or EdgeType.UsesEnvVar or EdgeType.Calls)
            .Select(e => $"{e.Type}: {graph.Find(e.TargetId)?.Name ?? e.TargetId}")
            .Concat(graph.Incoming(flow.Id, EdgeType.Triggers).Select(e => $"Triggered by: {e.SourceId}"))
            .Order().ToList();
        if (dependencies.Count == 0)
        {
            doc.Paragraph("None.", muted: true);
        }

        doc.List(dependencies);

        var unresolved = graph.Unresolved.Where(u => steps.Contains(u.NodeId)).ToList();
        doc.Heading(3, "Unresolved references");
        doc.Table(["Step", "Reason", "Expression"], unresolved.Select(u => (IReadOnlyList<string>)[graph.Find(u.NodeId)?.Name ?? u.NodeId, u.Reason, u.RawExpression]));

        doc.Heading(3, "Quality findings");
        doc.Table(["Rule", "Severity", "Step", "Finding"], QualityRules.Evaluate(graph, flow.Id)
            .Select(f => (IReadOnlyList<string>)[f.RuleId, f.Severity.ToString(), graph.Find(f.NodeId)?.Name ?? f.NodeId, f.Message]));
    }

    private static IEnumerable<(int, string)> StepTree(ComponentGraph graph, string parentId, int depth, IReadOnlyDictionary<string, IReadOnlyList<string>> tags)
    {
        foreach (var step in graph.Children(parentId).Where(n => n.Type.IsFlowStep()))
        {
            var text = $"{step.Name} — {step.Type}{(step.SubType is null || step.SubType == step.Type.ToString() ? "" : $" / {step.SubType}")}";
            if (step.Property(NodeProperties.OperationId) is { } operation)
            {
                text += $" ({operation})";
            }

            if (step.Branch is not null)
            {
                text = $"[{step.Branch}] " + text;
            }

            var runAfter = graph.Incoming(step.Id, EdgeType.RunsAfter)
                .Where(e => e.Status != RunStatus.Succeeded)
                .Select(e => $"{graph.Find(e.SourceId)?.Name} is {e.Status}")
                .ToList();
            if (runAfter.Count > 0)
            {
                text += $" · runs after {string.Join("; ", runAfter)}";
            }

            if (tags.TryGetValue(step.Id, out var stepTags) && stepTags.Count > 0)
            {
                text += $" · tags: {string.Join(", ", stepTags)}";
            }

            yield return (depth, text);
            foreach (var child in StepTree(graph, step.Id, depth + 1, tags))
            {
                yield return child;
            }
        }
    }

    private static void WriteSolutionComponents(DocWriter doc, ComponentGraph graph, DocOptions options)
    {
        doc.Heading(2, "Environment variables");
        doc.Table(options.IncludeEnvValues ? ["Schema name", "Display name", "Type", "Default value", "Current value"] : ["Schema name", "Display name", "Type"],
            graph.Nodes.Where(n => n.Type == NodeType.EnvVariable).OrderBy(n => n.Name).Select(n => (IReadOnlyList<string>)(options.IncludeEnvValues
                ? [n.Name, n.Property(NodeProperties.DisplayName) ?? "-", n.SubType ?? "-", n.Property(NodeProperties.DefaultValue) ?? "-", n.Property(NodeProperties.CurrentValue) ?? "-"]
                : [n.Name, n.Property(NodeProperties.DisplayName) ?? "-", n.SubType ?? "-"])));

        doc.Heading(2, "Connection references");
        doc.Table(["Logical name", "Display name", "Connector", "Used by flows"],
            graph.Nodes.Where(n => n.Type == NodeType.ConnectionReference).OrderBy(n => n.Name).Select(n => (IReadOnlyList<string>)
            [
                n.Name,
                n.Property(NodeProperties.DisplayName) ?? "-",
                n.Property(NodeProperties.ConnectorId) ?? "-",
                string.Join(", ", graph.Incoming(n.Id, EdgeType.UsesConnection).Where(e => graph.Find(e.SourceId)?.Type == NodeType.Flow).Select(e => graph.Find(e.SourceId)!.Name)),
            ]));

        doc.Heading(2, "Tables");
        doc.Table(["Table", "In solution", "Read by", "Written by"],
            graph.Nodes.Where(n => n.Type == NodeType.Table).OrderBy(n => n.Name).Select(n =>
            {
                var columns = graph.Children(n.Id).Select(c => c.Id).Append(n.Id).ToHashSet();
                string Users(EdgeType type) => string.Join(", ", graph.Edges.Where(e => e.Type == type && columns.Contains(e.TargetId))
                    .Select(e => GraphStore.FlowIdOf(e.SourceId) ?? e.SourceId).Distinct().Select(id => graph.Find(id)?.Name ?? id).Order());
                IReadOnlyList<string> row = [n.Name, n.IsPlaceholder ? "no" : "yes", Users(EdgeType.Reads), Users(EdgeType.Writes)];
                return row;
            }));
    }
}
