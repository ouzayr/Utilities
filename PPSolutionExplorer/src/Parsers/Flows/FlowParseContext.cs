using PPSolutionExplorer.Parsers.Dataverse;

namespace PPSolutionExplorer.Parsers.Flows;

/// <summary>Solution-level knowledge shared by every flow in an import.</summary>
public sealed class FlowParseContext
{
    public TableNameResolver Tables { get; init; } = TableNameResolver.Empty;

    /// <summary>Owning solution node, if the flow came from a solution.</summary>
    public string? SolutionNodeId { get; init; }

    public static FlowParseContext Standalone => new();
}
