using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Diff;

public enum ChangeKind
{
    Added,
    Removed,
    Changed,

    /// <summary>Parent or branch changed (may also have property changes).</summary>
    Moved,
}

/// <param name="Path">JSON path inside the raw source (e.g. <c>inputs/parameters/$filter</c>) or <c>name</c>, <c>parent</c>, <c>property:x</c>.</param>
public sealed record PropertyChange(string Path, string? Before, string? After);

public sealed record NodeChange(
    string NodeId,
    NodeType Type,
    string Name,
    ChangeKind Kind,
    string? FlowId,
    IReadOnlyList<PropertyChange> Changes);

public sealed record EdgeChange(string SourceId, string TargetId, EdgeType Type, ChangeKind Kind, string? Before, string? After);

public sealed record DiffSummary(int Added, int Removed, int Changed, int Moved, int EdgesChanged)
{
    public bool IsEmpty => Added + Removed + Changed + Moved + EdgesChanged == 0;
}

/// <summary>Result of comparing two graphs. "Left" is the baseline (older version or source environment).</summary>
public sealed record GraphDiff(IReadOnlyList<NodeChange> Nodes, IReadOnlyList<EdgeChange> Edges)
{
    public DiffSummary Summary => new(
        Nodes.Count(n => n.Kind == ChangeKind.Added),
        Nodes.Count(n => n.Kind == ChangeKind.Removed),
        Nodes.Count(n => n.Kind == ChangeKind.Changed),
        Nodes.Count(n => n.Kind == ChangeKind.Moved),
        Edges.Count);
}
