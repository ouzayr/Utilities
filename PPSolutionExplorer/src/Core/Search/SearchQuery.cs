using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Search;

/// <summary>
/// Structured search query. The only search input the store accepts: the UI builds it directly,
/// and the AI natural-language search produces one that is validated against <see cref="SearchFacets"/>.
/// It is never turned into raw SQL text.
/// </summary>
public sealed record SearchQuery
{
    public Guid? ImportId { get; init; }

    /// <summary>Free text matched against name, sub-type and (optionally) raw JSON.</summary>
    public string? Text { get; init; }

    public bool SearchRawJson { get; init; }

    public IReadOnlyList<NodeType> NodeTypes { get; init; } = [];

    /// <summary>Action type / operation, e.g. <c>OpenApiConnection</c>, <c>ListRecords</c>.</summary>
    public IReadOnlyList<string> SubTypes { get; init; } = [];

    /// <summary>Connector API names, e.g. <c>shared_commondataserviceforapps</c>.</summary>
    public IReadOnlyList<string> Connectors { get; init; } = [];

    /// <summary>Table node IDs or names the step reads or writes.</summary>
    public IReadOnlyList<string> Tables { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];

    /// <summary>Restrict to the steps of one flow.</summary>
    public string? FlowId { get; init; }

    public bool? HasUnresolved { get; init; }

    public int Limit { get; init; } = 200;
}

/// <summary>Known values for each facet. Used to validate model-produced queries.</summary>
public sealed record SearchFacets(
    IReadOnlyList<string> SubTypes,
    IReadOnlyList<string> Connectors,
    IReadOnlyList<string> Tables,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> FlowIds)
{
    public static readonly SearchFacets Empty = new([], [], [], [], []);

    /// <summary>
    /// Returns a copy that only keeps values known to the store. Unknown values are reported, not guessed.
    /// </summary>
    public (SearchQuery Query, IReadOnlyList<string> Dropped) Sanitise(SearchQuery query)
    {
        var dropped = new List<string>();

        IReadOnlyList<string> Keep(IReadOnlyList<string> values, IReadOnlyList<string> known, string facet)
        {
            var set = new HashSet<string>(known, StringComparer.OrdinalIgnoreCase);
            var kept = new List<string>();
            foreach (var value in values)
            {
                if (set.TryGetValue(value, out var canonical))
                {
                    kept.Add(canonical);
                }
                else
                {
                    dropped.Add($"{facet}:{value}");
                }
            }

            return kept;
        }

        var flowId = query.FlowId;
        if (flowId is not null && !FlowIds.Contains(flowId, StringComparer.OrdinalIgnoreCase))
        {
            dropped.Add($"flow:{flowId}");
            flowId = null;
        }

        var sanitised = query with
        {
            Text = string.IsNullOrWhiteSpace(query.Text) ? null : query.Text.Trim()[..Math.Min(query.Text.Trim().Length, 200)],
            NodeTypes = query.NodeTypes.Where(Enum.IsDefined).Distinct().ToList(),
            SubTypes = Keep(query.SubTypes, SubTypes, "subType"),
            Connectors = Keep(query.Connectors, Connectors, "connector"),
            Tables = Keep(query.Tables, Tables, "table"),
            Tags = Keep(query.Tags, Tags, "tag"),
            FlowId = flowId,
            Limit = Math.Clamp(query.Limit, 1, 1000),
        };

        return (sanitised, dropped);
    }
}
