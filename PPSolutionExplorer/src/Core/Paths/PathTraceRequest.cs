namespace PPSolutionExplorer.Core.Paths;

/// <param name="FlowId">Flow node ID.</param>
/// <param name="FromNodeId">Start step. Default: the flow trigger.</param>
/// <param name="ToNodeId">End step. Default: any path to the end of the flow.</param>
/// <param name="IncludeFailureBranches">Include runAfter edges taken only on Failed/TimedOut.</param>
/// <param name="MaxPaths">Enumeration cap. Counting is exact regardless.</param>
public sealed record PathTraceRequest(
    string FlowId,
    string? FromNodeId = null,
    string? ToNodeId = null,
    bool IncludeFailureBranches = true,
    int MaxPaths = PathTraceRequest.DefaultMaxPaths)
{
    public const int DefaultMaxPaths = 10_000;
}
