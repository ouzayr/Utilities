using System.Text.Json;
using System.Text.RegularExpressions;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Quality;

/// <summary>
/// Deterministic rule engine. Finds issues; the optional AI layer only explains them.
/// Rules can be disabled or re-graded per <see cref="QualityProfile"/>.
/// </summary>
public static partial class QualityRules
{
    public static readonly IReadOnlyList<RuleDefinition> Catalog =
    [
        new("PPSE001", "No error handling", "reliability", Severity.Warning, "No step runs after Failed or TimedOut, so failures are not handled (try/catch scope pattern missing)."),
        new("PPSE002", "Default step name", "maintainability", Severity.Info, "Step still has the designer's default name (e.g. Compose_3)."),
        new("PPSE003", "Deep nesting", "maintainability", Severity.Warning, "Step nested deeper than the profile's MaxNestingDepth."),
        new("PPSE004", "Dynamic reference", "maintainability", Severity.Info, "Reference computed at run time; cannot be resolved statically."),
        new("PPSE005", "Hard-coded GUID", "maintainability", Severity.Warning, "GUID literal in inputs; breaks when moving between environments."),
        new("PPSE006", "Unknown action type", "maintainability", Severity.Info, "Action type not recognised by the parser; raw JSON kept."),
        new("PPSE007", "List rows without limit", "performance", Severity.Warning, "Dataverse List rows without $top or pagination returns only the first page."),
        new("PPSE008", "Broken reference", "reliability", Severity.Error, "Expression or runAfter points at an action or variable that does not exist."),
        new("PPSE009", "Unused variable", "maintainability", Severity.Warning, "Variable is initialised but never read."),
        new("PPSE010", "Unused output", "performance", Severity.Info, "Data operation whose output is never used (redundant action)."),
        new("PPSE011", "Sequential loop", "performance", Severity.Info, "Apply to each calls connectors without a concurrency setting, so iterations run one by one."),
        new("PPSE012", "Secret in plain text", "security", Severity.Error, "Literal value for a password/secret/token/authorization input."),
        new("PPSE013", "Hard-coded URL", "maintainability", Severity.Info, "Literal URL in inputs; use an environment variable."),
        new("PPSE014", "Large flow", "maintainability", Severity.Info, "Flow has more steps than the profile's MaxActions; consider child flows."),
    ];

    private static readonly Dictionary<string, RuleDefinition> ById = Catalog.ToDictionary(r => r.Id);

    private static readonly HashSet<string> PureDataOperations = new(StringComparer.OrdinalIgnoreCase)
    {
        "Compose", "Select", "Query", "ParseJson", "Join", "Table", "Expression",
    };

    private static readonly HashSet<string> SequentialOnlyTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "SetVariable", "IncrementVariable", "DecrementVariable", "AppendToArrayVariable", "AppendToStringVariable",
    };

    private static readonly HashSet<string> ConnectorTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "OpenApiConnection", "ApiConnection", "Http", "Workflow", "ServiceProvider",
    };

    /// <summary>Kept for callers that only need the default threshold.</summary>
    public const int MaxNestingDepth = 6;

    public static IReadOnlyList<QualityFinding> Evaluate(ComponentGraph graph, string flowId, QualityProfile? profile = null)
    {
        profile ??= QualityProfile.Default;
        var flow = graph.Find(flowId) ?? throw new KeyNotFoundException(flowId);
        var steps = graph.Descendants(flow.Id).Where(n => n.Type.IsFlowStep()).ToList();
        var context = new Context(graph, flow, steps, profile, []);

        NoErrorHandling(context);
        DefaultNames(context);
        DeepNesting(context);
        Unresolved(context);
        HardCodedIds(context);
        UnknownTypes(context);
        ListWithoutTop(context);
        UnusedVariables(context);
        UnusedOutputs(context);
        SequentialLoops(context);
        LiteralSecretsAndUrls(context);
        LargeFlow(context);

        return context.Findings;
    }

    private sealed record Context(ComponentGraph Graph, GraphNode Flow, List<GraphNode> Steps, QualityProfile Profile, List<QualityFinding> Findings)
    {
        public void Add(string ruleId, string nodeId, string message, string? evidence = null)
        {
            if (Profile.IsEnabled(ruleId))
            {
                Findings.Add(new QualityFinding(ruleId, Profile.SeverityOf(ById[ruleId]), nodeId, message, evidence));
            }
        }
    }

    private static void NoErrorHandling(Context c)
    {
        var hasFailureHandler = c.Steps.Any(s => c.Graph.Incoming(s.Id, EdgeType.RunsAfter)
            .Any(e => (e.Status & (RunStatus.Failed | RunStatus.TimedOut)) != 0));

        if (c.Steps.Count > 1 && !hasFailureHandler)
        {
            c.Add("PPSE001", c.Flow.Id, "Flow has no step configured to run after Failed or TimedOut. Failures are not handled.");
        }
    }

    private static void DefaultNames(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.Type != NodeType.Trigger && DefaultNamePattern().IsMatch(s.Name)))
        {
            c.Add("PPSE002", step.Id, $"Step '{step.Name}' still has a default name. Rename it to describe its purpose.");
        }
    }

    private static void DeepNesting(Context c)
    {
        foreach (var step in c.Steps.Where(s => !s.Type.IsContainer()))
        {
            var depth = Depth(c.Graph, c.Flow.Id, step);
            if (depth > c.Profile.MaxNestingDepth)
            {
                c.Add("PPSE003", step.Id, $"Step is nested {depth} levels deep (limit {c.Profile.MaxNestingDepth}). Consider a child flow.");
            }
        }
    }

    private static void Unresolved(Context c)
    {
        var ids = c.Steps.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var reference in c.Graph.Unresolved.Where(u => ids.Contains(u.NodeId)))
        {
            if (reference.IsBroken)
            {
                c.Add("PPSE008", reference.NodeId, $"Broken reference: {reference.Reason[UnresolvedReference.BrokenPrefix.Length..]}.", reference.RawExpression);
            }
            else
            {
                c.Add("PPSE004", reference.NodeId, $"Reference could not be resolved statically: {reference.Reason}.", reference.RawExpression);
            }
        }
    }

    private static void HardCodedIds(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.Type != NodeType.Trigger))
        {
            if (InputsOf(step) is { } inputs && GuidPattern().Match(inputs.GetRawText()) is { Success: true } match)
            {
                c.Add("PPSE005", step.Id, "Hard-coded GUID in inputs. Use an environment variable so the flow survives environment moves.", match.Value);
            }
        }
    }

    private static void UnknownTypes(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.Type == NodeType.Unknown))
        {
            c.Add("PPSE006", step.Id, $"Action type '{step.SubType}' is not recognised by the parser. Raw JSON is kept.");
        }
    }

    private static void ListWithoutTop(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.Property(NodeProperties.OperationId) is "ListRecords" or "ListRecordsWithOrganization"))
        {
            if (step.RawJson is not null && !step.RawJson.Contains("\"$top\"", StringComparison.Ordinal) &&
                !step.RawJson.Contains("\"paginationPolicy\"", StringComparison.Ordinal))
            {
                c.Add("PPSE007", step.Id, "Dataverse 'List rows' without $top or pagination: only the first page (5,000 rows) is returned.");
            }
        }
    }

    private static void UnusedVariables(Context c)
    {
        foreach (var step in c.Steps.Where(s => string.Equals(s.SubType, "InitializeVariable", StringComparison.OrdinalIgnoreCase)))
        {
            // The parser links every variables('x') read to the declaring action with a DataFlow edge.
            if (!c.Graph.Outgoing(step.Id, EdgeType.DataFlow).Any())
            {
                c.Add("PPSE009", step.Id, $"Variable declared in '{step.Name}' is never read.");
            }
        }
    }

    private static void UnusedOutputs(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.SubType is not null && PureDataOperations.Contains(s.SubType)))
        {
            if (!c.Graph.Outgoing(step.Id, EdgeType.DataFlow).Any())
            {
                c.Add("PPSE010", step.Id, $"Output of '{step.Name}' ({step.SubType}) is never used. Remove it or use it.");
            }
        }
    }

    private static void SequentialLoops(Context c)
    {
        foreach (var loop in c.Steps.Where(s => string.Equals(s.SubType, "Foreach", StringComparison.OrdinalIgnoreCase)))
        {
            if (loop.Property(NodeProperties.ConcurrencyRepetitions) is not null)
            {
                continue;
            }

            var body = c.Graph.Descendants(loop.Id).ToList();
            var callsConnectors = body.Any(s => s.SubType is not null && ConnectorTypes.Contains(s.SubType));
            var needsSequential = body.Any(s => s.SubType is not null && SequentialOnlyTypes.Contains(s.SubType));
            if (callsConnectors && !needsSequential)
            {
                c.Add("PPSE011", loop.Id, $"'{loop.Name}' calls connectors one item at a time. Enable concurrency control if order does not matter.");
            }
        }
    }

    private static void LiteralSecretsAndUrls(Context c)
    {
        foreach (var step in c.Steps.Where(s => s.Type != NodeType.Trigger || s.SubType is "Http"))
        {
            if (InputsOf(step) is not { } inputs)
            {
                continue;
            }

            var secretReported = false;
            var urlReported = false;
            foreach (var (key, value) in Strings(inputs, ""))
            {
                if (value.StartsWith('@'))
                {
                    continue;
                }

                if (!secretReported && value.Length > 0 && IsSecretKey(key, c.Profile) && !value.StartsWith("Bearer @", StringComparison.Ordinal))
                {
                    // Evidence names the key only; the value itself is never echoed.
                    c.Add("PPSE012", step.Id, $"Literal value for '{key}'. Store secrets in Azure Key Vault or a secret environment variable.", key);
                    secretReported = true;
                }

                if (!urlReported && UrlPattern().IsMatch(value))
                {
                    c.Add("PPSE013", step.Id, "Hard-coded URL in inputs. Use an environment variable.", value.Length > 200 ? value[..200] : value);
                    urlReported = true;
                }
            }
        }
    }

    private static void LargeFlow(Context c)
    {
        var count = c.Steps.Count(s => s.Type != NodeType.Trigger);
        if (count > c.Profile.MaxActions)
        {
            c.Add("PPSE014", c.Flow.Id, $"Flow has {count} steps (limit {c.Profile.MaxActions}). Split it into child flows.");
        }
    }

    private static bool IsSecretKey(string key, QualityProfile profile)
    {
        var last = key.Split('/', '.').Last();
        return profile.EffectiveSecretKeys.Any(k => last.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>All string leaves with their key path (e.g. <c>headers/Authorization</c>).</summary>
    private static IEnumerable<(string Key, string Value)> Strings(JsonElement element, string path)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                yield return (path, element.GetString()!);
                break;
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    foreach (var item in Strings(property.Value, path.Length == 0 ? property.Name : $"{path}/{property.Name}"))
                    {
                        yield return item;
                    }
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray().SelectMany(e => Strings(e, path)))
                {
                    yield return item;
                }

                break;
        }
    }

    internal static int Depth(ComponentGraph graph, string flowId, GraphNode step)
    {
        var depth = 0;
        var current = step;
        while (current.ParentId is not null && current.ParentId != flowId && graph.Find(current.ParentId) is { } parent)
        {
            depth++;
            current = parent;
        }

        return depth;
    }

    private static JsonElement? InputsOf(GraphNode step)
    {
        if (step.RawJson is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(step.RawJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("inputs", out var inputs)
                ? inputs.Clone()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    [GeneratedRegex(@"^(Compose|Condition|Apply_to_each|Scope|Switch|Do_until|Initialize_variable|Set_variable|Append_to_array_variable|HTTP|Parse_JSON|Filter_array|Select|List_rows|Get_a_row_by_ID|Add_a_new_row|Update_a_row|Delete_a_row|Send_an_email_\(V2\)|Terminate)(_\d+)?$")]
    private static partial Regex DefaultNamePattern();

    [GeneratedRegex(@"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")]
    private static partial Regex GuidPattern();

    [GeneratedRegex(@"^https?://[^\s]+$", RegexOptions.IgnoreCase)]
    private static partial Regex UrlPattern();
}
