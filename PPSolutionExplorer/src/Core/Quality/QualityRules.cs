using System.Text.Json;
using System.Text.RegularExpressions;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Quality;

/// <summary>
/// Deterministic rule engine. Finds issues; the optional AI layer only explains them.
/// </summary>
public static partial class QualityRules
{
    public const int MaxNestingDepth = 6;

    public static IReadOnlyList<QualityFinding> Evaluate(ComponentGraph graph, string flowId)
    {
        var findings = new List<QualityFinding>();
        var flow = graph.Find(flowId) ?? throw new KeyNotFoundException(flowId);
        var steps = graph.Descendants(flow.Id).Where(n => n.Type.IsFlowStep()).ToList();

        NoErrorHandling(graph, flow, steps, findings);
        DefaultNames(steps, findings);
        DeepNesting(graph, flow, steps, findings);
        Unresolved(graph, steps, findings);
        HardCodedIds(steps, findings);
        UnknownTypes(steps, findings);
        ListWithoutTop(steps, findings);

        return findings;
    }

    private static void NoErrorHandling(ComponentGraph graph, GraphNode flow, List<GraphNode> steps, List<QualityFinding> findings)
    {
        var hasFailureHandler = graph.Edges.Any(e =>
            e.Type == EdgeType.RunsAfter &&
            (e.Status & (RunStatus.Failed | RunStatus.TimedOut)) != 0 &&
            steps.Any(s => s.Id == e.TargetId));

        if (steps.Count > 0 && !hasFailureHandler)
        {
            findings.Add(new QualityFinding("PPSE001", Severity.Warning, flow.Id,
                "Flow has no step configured to run after Failed or TimedOut. Failures are not handled."));
        }
    }

    private static void DefaultNames(List<GraphNode> steps, List<QualityFinding> findings)
    {
        foreach (var step in steps.Where(s => s.Type != NodeType.Trigger && DefaultNamePattern().IsMatch(s.Name)))
        {
            findings.Add(new QualityFinding("PPSE002", Severity.Info, step.Id,
                $"Step '{step.Name}' still has a default name. Rename it to describe its purpose."));
        }
    }

    private static void DeepNesting(ComponentGraph graph, GraphNode flow, List<GraphNode> steps, List<QualityFinding> findings)
    {
        foreach (var step in steps)
        {
            var depth = 0;
            var current = step;
            while (current.ParentId is not null && current.ParentId != flow.Id && graph.Find(current.ParentId) is { } parent)
            {
                depth++;
                current = parent;
            }

            if (depth > MaxNestingDepth && !step.Type.IsContainer())
            {
                findings.Add(new QualityFinding("PPSE003", Severity.Warning, step.Id,
                    $"Step is nested {depth} levels deep (limit {MaxNestingDepth}). Consider a child flow."));
            }
        }
    }

    private static void Unresolved(ComponentGraph graph, List<GraphNode> steps, List<QualityFinding> findings)
    {
        var ids = steps.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var reference in graph.Unresolved.Where(u => ids.Contains(u.NodeId)))
        {
            findings.Add(new QualityFinding("PPSE004", Severity.Info, reference.NodeId,
                $"Reference could not be resolved statically: {reference.Reason}.", reference.RawExpression));
        }
    }

    private static void HardCodedIds(List<GraphNode> steps, List<QualityFinding> findings)
    {
        foreach (var step in steps.Where(s => s.RawJson is not null && s.Type != NodeType.Trigger))
        {
            var inputs = InputsOf(step.RawJson!);
            if (inputs is null)
            {
                continue;
            }

            var match = GuidPattern().Match(inputs);
            if (match.Success)
            {
                findings.Add(new QualityFinding("PPSE005", Severity.Warning, step.Id,
                    "Hard-coded GUID in inputs. Use an environment variable so the flow survives environment moves.",
                    match.Value));
            }
        }
    }

    private static void UnknownTypes(List<GraphNode> steps, List<QualityFinding> findings)
    {
        foreach (var step in steps.Where(s => s.Type == NodeType.Unknown))
        {
            findings.Add(new QualityFinding("PPSE006", Severity.Info, step.Id,
                $"Action type '{step.SubType}' is not recognised by the parser. Raw JSON is kept."));
        }
    }

    private static void ListWithoutTop(List<GraphNode> steps, List<QualityFinding> findings)
    {
        foreach (var step in steps.Where(s => s.Property(NodeProperties.OperationId) == "ListRecords"))
        {
            if (step.RawJson is not null && !step.RawJson.Contains("\"$top\"", StringComparison.Ordinal) &&
                !step.RawJson.Contains("\"paginationPolicy\"", StringComparison.Ordinal))
            {
                findings.Add(new QualityFinding("PPSE007", Severity.Info, step.Id,
                    "Dataverse 'List rows' without $top or pagination: only the first page (5,000 rows) is returned."));
            }
        }
    }

    [GeneratedRegex(@"^(Compose|Condition|Apply_to_each|Scope|Switch|Do_until|Initialize_variable|Set_variable|Append_to_array_variable|HTTP|Parse_JSON|Filter_array|Select|List_rows|Get_a_row_by_ID|Add_a_new_row|Update_a_row|Delete_a_row|Send_an_email_\(V2\)|Terminate)(_\d+)?$")]
    private static partial Regex DefaultNamePattern();

    [GeneratedRegex(@"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")]
    private static partial Regex GuidPattern();

    private static string? InputsOf(string rawJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("inputs", out var inputs)
                ? inputs.GetRawText()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
