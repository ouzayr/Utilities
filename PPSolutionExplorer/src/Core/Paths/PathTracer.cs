using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Paths;

/// <summary>
/// Path tracing over a flow: counts paths with DP (cheap, exact), then enumerates with DFS up to a cap.
/// Pure and deterministic; no I/O.
/// </summary>
public static class PathTracer
{
    public static PathTraceResult Trace(ComponentGraph graph, PathTraceRequest request)
    {
        ArgumentNullException.ThrowIfNull(graph);
        ArgumentNullException.ThrowIfNull(request);
        if (graph.Find(request.FlowId) is not { Type: NodeType.Flow })
        {
            throw new ArgumentException($"'{request.FlowId}' is not a flow.", nameof(request));
        }

        var cfg = new ExecutionGraph(graph, request.FlowId, request.IncludeFailureBranches);
        var start = request.FromNodeId ?? cfg.EntryId;
        var target = request.ToNodeId ?? ExecutionGraph.ExitId;
        var warnings = new List<string>(cfg.Warnings);

        var counts = new Dictionary<string, long>(StringComparer.Ordinal);
        var onStack = new HashSet<string>(StringComparer.Ordinal);
        var total = Count(cfg, start, target, counts, onStack, warnings);

        var cap = Math.Max(0, request.MaxPaths);
        var paths = new List<ExecutionPath>();
        if (total > 0 && cap > 0)
        {
            Enumerate(cfg, start, target, cap, counts, paths);
        }

        return new PathTraceResult(total, paths.Count, total > paths.Count, paths, warnings);
    }

    private static long Count(ExecutionGraph cfg, string node, string target, Dictionary<string, long> memo, HashSet<string> onStack, List<string> warnings)
    {
        if (node == target)
        {
            return 1;
        }

        if (memo.TryGetValue(node, out var cached))
        {
            return cached;
        }

        if (!onStack.Add(node))
        {
            // runAfter graphs are acyclic; a cycle means malformed input. Break it and say so.
            warnings.Add($"Cycle detected at '{node}'. Edge ignored.");
            return 0;
        }

        long sum = 0;
        foreach (var arc in cfg.Next(node))
        {
            sum = SaturatingAdd(sum, Count(cfg, arc.To, target, memo, onStack, warnings));
        }

        onStack.Remove(node);
        memo[node] = sum;
        return sum;
    }

    private static void Enumerate(ExecutionGraph cfg, string start, string target, int cap, Dictionary<string, long> counts, List<ExecutionPath> results)
    {
        var steps = new List<PathStep> { new(start, null, RunStatus.None) };
        var visiting = new HashSet<string>(StringComparer.Ordinal) { start };
        Dfs(start);

        void Dfs(string node)
        {
            if (results.Count >= cap)
            {
                return;
            }

            if (node == target)
            {
                var real = steps.Where(s => !ExecutionGraph.IsVirtual(s.NodeId)).ToList();
                results.Add(new ExecutionPath(
                    real,
                    Iterated: steps.Any(s => cfg.IsLoop(s.NodeId)),
                    UsesFailureBranch: steps.Any(s => s.ViaStatus.IsFailureOnly())));
                return;
            }

            foreach (var arc in cfg.Next(node))
            {
                // Prune branches the DP says cannot reach the target.
                var reachable = arc.To == target || counts.GetValueOrDefault(arc.To) > 0;
                if (!reachable || !visiting.Add(arc.To))
                {
                    continue;
                }

                steps.Add(new PathStep(arc.To, arc.Branch, arc.Status));
                Dfs(arc.To);
                steps.RemoveAt(steps.Count - 1);
                visiting.Remove(arc.To);

                if (results.Count >= cap)
                {
                    return;
                }
            }
        }
    }

    private static long SaturatingAdd(long a, long b) => a > long.MaxValue - b ? long.MaxValue : a + b;
}
