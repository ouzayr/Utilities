using System.Text;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Api.Docs;

/// <summary>
/// Mermaid flowchart of a flow: containers become subgraphs, condition/switch branches nested subgraphs,
/// runAfter edges arrows (failure-only dotted). Rendered by Mermaid-capable Markdown viewers.
/// </summary>
public static class MermaidBuilder
{
    public const int MaxSteps = 300;

    public static string? Build(ComponentGraph graph, string flowId)
    {
        var steps = graph.Descendants(flowId).Where(n => n.Type.IsFlowStep()).ToList();
        if (steps.Count == 0 || steps.Count > MaxSteps)
        {
            return null;
        }

        var ids = new Dictionary<string, string>(StringComparer.Ordinal);
        string Id(string key) => ids.TryGetValue(key, out var id) ? id : ids[key] = "n" + ids.Count;

        var sb = new StringBuilder("flowchart TD\n");
        WriteBlock(flowId, "  ");

        var trigger = steps.FirstOrDefault(s => s.Type == NodeType.Trigger);
        foreach (var step in steps)
        {
            foreach (var edge in graph.Incoming(step.Id, EdgeType.RunsAfter))
            {
                var failureOnly = edge.Status.IsFailureOnly();
                var label = edge.Status == RunStatus.Succeeded ? "" : $"|{edge.Status.ToString().Replace(",", "")}|";
                sb.Append("  ").Append(Id(edge.SourceId)).Append(failureOnly ? " -.->" : " -->").Append(label).Append(' ').AppendLine(Id(step.Id));
            }

            if (trigger is not null && step.ParentId == flowId && step.Type != NodeType.Trigger && !graph.Incoming(step.Id, EdgeType.RunsAfter).Any())
            {
                sb.Append("  ").Append(Id(trigger.Id)).Append(" --> ").AppendLine(Id(step.Id));
            }
        }

        sb.AppendLine("  classDef unknown fill:#fff8c5,stroke:#d4a72c;");
        return sb.ToString();

        void WriteBlock(string parentId, string indent)
        {
            var children = graph.Children(parentId).Where(n => n.Type.IsFlowStep()).ToList();
            var parent = graph.Find(parentId);
            var lanes = parent?.Type is NodeType.Condition or NodeType.Switch;
            foreach (var group in children.GroupBy(c => lanes ? c.Branch ?? "" : ""))
            {
                var inner = indent;
                if (lanes)
                {
                    sb.Append(indent).Append("subgraph ").Append(Id(parentId + "#" + group.Key)).Append("[\"").Append(Escape(group.Key)).AppendLine("\"]");
                    inner += "  ";
                }

                foreach (var child in group)
                {
                    if (child.Type.IsContainer())
                    {
                        sb.Append(inner).Append("subgraph ").Append(Id(child.Id)).Append("[\"").Append(Escape($"{child.Name} ({child.Type})")).AppendLine("\"]");
                        sb.Append(inner).AppendLine("  direction TB");
                        WriteBlock(child.Id, inner + "  ");
                        sb.Append(inner).AppendLine("end");
                    }
                    else
                    {
                        sb.Append(inner).Append(Id(child.Id)).Append("[\"").Append(Escape(child.Name)).Append("\"]");
                        sb.AppendLine(child.Type == NodeType.Unknown ? ":::unknown" : "");
                    }
                }

                if (lanes)
                {
                    sb.Append(indent).AppendLine("end");
                }
            }
        }
    }

    private static string Escape(string text) => text.Replace("\"", "#quot;").Replace("<", "#lt;").Replace(">", "#gt;");
}
