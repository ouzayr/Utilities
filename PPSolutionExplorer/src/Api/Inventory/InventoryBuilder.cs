using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Quality;

namespace PPSolutionExplorer.Api.Inventory;

/// <summary>
/// Licensing/lifecycle lists. They change over time and are not in exports, so they are configuration:
/// review them against current Microsoft documentation before relying on the premium/deprecated flags.
/// </summary>
public sealed class InventoryOptions
{
    public const string Section = "Inventory";

    // Note: the configuration binder appends to non-null collections, so defaults live in separate
    // properties and a configured list replaces them instead of being merged into them.
    public static readonly IReadOnlyList<string> DefaultPremiumConnectors =
    [
        "builtin:http", "shared_commondataserviceforapps", "shared_sql", "shared_azureblob", "shared_servicebus",
        "shared_salesforce", "shared_azureloganalyticsdatacollector", "shared_keyvault",
    ];

    public static readonly IReadOnlyList<string> DefaultDeprecatedOperations =
    [
        "shared_commondataservice",
        "shared_office365/SendEmail",
    ];

    /// <summary>Connector API names (e.g. <c>shared_sql</c>) or <c>builtin:http</c> treated as premium. Null: defaults.</summary>
    public List<string>? PremiumConnectors { get; set; }

    /// <summary>Entries <c>connector</c>, <c>connector/operationId</c> or <c>type:ActionType</c> considered deprecated. Null: defaults.</summary>
    public List<string>? DeprecatedOperations { get; set; }

    public IReadOnlyList<string> Premium => PremiumConnectors ?? DefaultPremiumConnectors;

    public IReadOnlyList<string> Deprecated => DeprecatedOperations ?? DefaultDeprecatedOperations;
}

public sealed record ConnectorUsage(string Connector, bool Premium, IReadOnlyList<string> ConnectionReferences, IReadOnlyList<string> Flows, int Steps);

public sealed record FlowInventory(string FlowId, string Name, string? State, string? Trigger, int Steps, bool UsesPremium, IReadOnlyList<string> Connectors, FlowComplexity Complexity);

public sealed record DeprecatedUsage(string FlowId, string FlowName, string StepId, string StepName, string Match);

public sealed record InventoryReport(
    IReadOnlyList<ConnectorUsage> Connectors,
    IReadOnlyList<FlowInventory> Flows,
    IReadOnlyList<DeprecatedUsage> Deprecated,
    string Note);

public static class InventoryBuilder
{
    public const string HttpKey = "builtin:http";

    public static InventoryReport Build(ComponentGraph graph, InventoryOptions options)
    {
        var premium = new HashSet<string>(options.Premium, StringComparer.OrdinalIgnoreCase);
        var flows = graph.Nodes.Where(n => n.Type == NodeType.Flow && !n.IsPlaceholder).OrderBy(n => n.Name).ToList();
        var usage = new Dictionary<string, (HashSet<string> Refs, HashSet<string> Flows, int Steps)>(StringComparer.OrdinalIgnoreCase);
        var flowRows = new List<FlowInventory>();
        var deprecated = new List<DeprecatedUsage>();

        foreach (var flow in flows)
        {
            var steps = graph.Descendants(flow.Id).Where(n => n.Type.IsFlowStep()).ToList();
            var connectors = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var step in steps)
            {
                var key = ConnectorKey(graph, step);
                if (key is not null)
                {
                    connectors.Add(key);
                    if (!usage.TryGetValue(key, out var entry))
                    {
                        usage[key] = entry = ([], [], 0);
                    }

                    entry.Flows.Add(flow.Name);
                    foreach (var reference in graph.Outgoing(step.Id, EdgeType.UsesConnection).Where(e => e.TargetId.StartsWith("connref:", StringComparison.Ordinal)))
                    {
                        entry.Refs.Add(graph.Find(reference.TargetId)?.Name ?? reference.TargetId);
                    }

                    usage[key] = entry with { Steps = entry.Steps + 1 };
                }

                if (DeprecatedMatch(step, key, options.Deprecated) is { } match)
                {
                    deprecated.Add(new DeprecatedUsage(flow.Id, flow.Name, step.Id, step.Name, match));
                }
            }

            var trigger = steps.FirstOrDefault(s => s.Type == NodeType.Trigger);
            flowRows.Add(new FlowInventory(
                flow.Id, flow.Name, flow.Property(NodeProperties.State),
                trigger is null ? null : $"{trigger.Name} ({trigger.Property(NodeProperties.OperationId) ?? trigger.SubType})",
                steps.Count(s => s.Type != NodeType.Trigger),
                connectors.Any(premium.Contains),
                connectors.Order(StringComparer.OrdinalIgnoreCase).ToList(),
                ComplexityCalculator.Calculate(graph, flow.Id)));
        }

        var connectorRows = usage.OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .Select(kv => new ConnectorUsage(kv.Key, premium.Contains(kv.Key), kv.Value.Refs.Order().ToList(), kv.Value.Flows.Order().ToList(), kv.Value.Steps))
            .ToList();

        return new InventoryReport(connectorRows, flowRows, deprecated,
            "Premium and deprecated flags come from the configurable Inventory lists, not from Microsoft. Owners are not part of solution exports and are not shown.");
    }

    private static string? ConnectorKey(ComponentGraph graph, GraphNode step)
    {
        if (step.SubType is "Http" or "HttpWebhook")
        {
            return HttpKey;
        }

        // Prefer the connector behind the connection reference (solution flows), else the apiId.
        foreach (var edge in graph.Outgoing(step.Id, EdgeType.UsesConnection))
        {
            if (edge.TargetId.StartsWith("connector:", StringComparison.Ordinal))
            {
                return edge.TargetId["connector:".Length..];
            }

            if (graph.Outgoing(edge.TargetId, EdgeType.UsesConnection).FirstOrDefault() is { } viaReference)
            {
                return viaReference.TargetId["connector:".Length..];
            }
        }

        return step.Property(NodeProperties.ConnectorId);
    }

    private static string? DeprecatedMatch(GraphNode step, string? connector, IReadOnlyList<string> entries)
    {
        var operation = step.Property(NodeProperties.OperationId);
        foreach (var entry in entries)
        {
            if (entry.StartsWith("type:", StringComparison.OrdinalIgnoreCase))
            {
                if (string.Equals(step.SubType, entry[5..], StringComparison.OrdinalIgnoreCase))
                {
                    return entry;
                }

                continue;
            }

            var parts = entry.Split('/', 2);
            if (connector is not null && string.Equals(parts[0], connector, StringComparison.OrdinalIgnoreCase) &&
                (parts.Length == 1 || string.Equals(parts[1], operation, StringComparison.OrdinalIgnoreCase)))
            {
                return entry;
            }
        }

        return null;
    }
}
