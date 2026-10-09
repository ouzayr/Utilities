namespace PPSolutionExplorer.Core.Model;

/// <param name="Expression">The expression that produced the edge (DataFlow, Reads, Writes).</param>
public sealed record GraphEdge(
    string SourceId,
    string TargetId,
    EdgeType Type,
    RunStatus Status = RunStatus.None,
    string? Expression = null);
