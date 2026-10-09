using System.Text;
using System.Text.Json;
using PPSolutionExplorer.Ai.Redaction;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Ai.Chunking;

/// <summary>
/// Compact, redacted text form of a flow step for prompts. One step renders to one block; blocks are never split.
/// </summary>
public static class StepRenderer
{
    public const int MaxInputChars = 1500;

    public static string Render(ComponentGraph graph, GraphNode step, Redactor redactor, string? childSummary = null)
    {
        var builder = new StringBuilder();
        builder.Append("- step: ").Append(step.Name).Append(" (").Append(step.Type);
        if (step.SubType is not null)
        {
            builder.Append(", ").Append(step.SubType);
        }

        builder.Append(')');
        if (step.Branch is not null)
        {
            builder.Append(" branch=").Append(step.Branch);
        }

        builder.AppendLine();

        if (step.Property(NodeProperties.ConnectorId) is { } connector)
        {
            builder.Append("  connector: ").Append(connector);
            if (step.Property(NodeProperties.OperationId) is { } operation)
            {
                builder.Append(" / ").Append(operation);
            }

            builder.AppendLine();
        }

        var runAfter = graph.Incoming(step.Id, EdgeType.RunsAfter).ToList();
        if (runAfter.Count > 0)
        {
            builder.Append("  runAfter: ")
                .AppendJoin(", ", runAfter.Select(e => $"{graph.Find(e.SourceId)?.Name ?? e.SourceId} [{e.Status}]"))
                .AppendLine();
        }

        var tables = graph.Outgoing(step.Id).Where(e => e.Type is EdgeType.Reads or EdgeType.Writes && e.TargetId.StartsWith("table:", StringComparison.Ordinal)).ToList();
        foreach (var edge in tables)
        {
            builder.Append("  ").Append(edge.Type == EdgeType.Reads ? "reads" : "writes").Append(" table: ").Append(edge.TargetId["table:".Length..]).AppendLine();
        }

        if (childSummary is not null)
        {
            builder.Append("  summary of contents: ").AppendLine(redactor.Redact(childSummary));
        }
        else if (Inputs(step) is { } inputs)
        {
            var redacted = redactor.Redact(inputs);
            builder.Append("  inputs: ").AppendLine(redacted.Length > MaxInputChars ? redacted[..MaxInputChars] + " …(truncated)" : redacted);
        }

        return builder.ToString();
    }

    /// <summary>Neutralises the delimiter so flow content cannot close the data block.</summary>
    public static string Fence(string content) =>
        "<flow_data>\n" + content.Replace("<flow_data>", "<flow-data>", StringComparison.OrdinalIgnoreCase)
            .Replace("</flow_data>", "</flow-data>", StringComparison.OrdinalIgnoreCase) + "\n</flow_data>";

    private static string? Inputs(GraphNode step)
    {
        if (step.RawJson is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(step.RawJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (var key in new[] { "inputs", "expression", "foreach" })
            {
                if (root.TryGetProperty(key, out var value))
                {
                    return value.GetRawText();
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }
}
