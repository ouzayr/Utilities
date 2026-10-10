using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Paths;

/// <param name="Branch">Branch taken to enter this step (e.g. <c>true</c>, <c>else</c>, <c>case:X</c>).</param>
/// <param name="ViaStatus">runAfter status set of the edge used to reach this step.</param>
public sealed record PathStep(string NodeId, string? Branch, RunStatus ViaStatus);

/// <param name="Iterated">Path passes through a loop body (traversed once).</param>
public sealed record ExecutionPath(IReadOnlyList<PathStep> Steps, bool Iterated, bool UsesFailureBranch);

/// <param name="TotalEstimated">Exact DP count, saturated at <see cref="long.MaxValue"/>.</param>
public sealed record PathTraceResult(
    long TotalEstimated,
    int Returned,
    bool Truncated,
    IReadOnlyList<ExecutionPath> Paths,
    IReadOnlyList<string> Warnings);
