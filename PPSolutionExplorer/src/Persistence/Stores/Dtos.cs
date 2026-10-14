using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Persistence.Stores;

public sealed record ImportSummary(
    Guid Id, string Kind, string Name, string? Version, string FileName, DateTimeOffset ImportedAt,
    int NodeCount, int EdgeCount, int UnresolvedCount, IReadOnlyList<string> Warnings);

public sealed record NodeSummary(
    string Id, NodeType Type, string Name, string? ParentId, string? Branch, string? SubType,
    string? Connector, string? Operation, IReadOnlyList<string> Tags);

public sealed record SearchHit(NodeSummary Node, string? FlowId, string? FlowName);

public sealed record ImpactItem(NodeSummary Node, int Depth, string Via, string? FlowId, string? FlowName);

public sealed record ImpactResult(string NodeId, int MaxDepth, IReadOnlyList<ImpactItem> Items);
