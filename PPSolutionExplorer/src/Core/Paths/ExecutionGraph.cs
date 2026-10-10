using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Paths;

/// <summary>
/// Control-flow graph derived from a flow's nesting and runAfter edges.
/// Containers get a virtual "end" node; the flow gets a single virtual exit.
/// Loop bodies are traversed once.
/// </summary>
internal sealed class ExecutionGraph
{
    public const string ExitId = "#exit";
    private const string EndSuffix = "#end";

    public sealed record Arc(string To, string? Branch, RunStatus Status);

    private readonly Dictionary<string, List<Arc>> _arcs = new(StringComparer.Ordinal);
    private readonly HashSet<string> _loopNodes = new(StringComparer.Ordinal);

    public string EntryId { get; }

    public List<string> Warnings { get; } = [];

    public ExecutionGraph(ComponentGraph graph, string flowId, bool includeFailureBranches)
    {
        var trigger = graph.Children(flowId).FirstOrDefault(n => n.Type == NodeType.Trigger);
        EntryId = trigger?.Id ?? flowId;

        var runAfter = graph.Edges
            .Where(e => e.Type == EdgeType.RunsAfter)
            .Where(e => includeFailureBranches || !e.Status.IsFailureOnly())
            .ToList();

        var rootSteps = graph.Children(flowId).Where(n => n.Type != NodeType.Trigger).ToList();
        WireBlock(graph, rootSteps, EntryId, ExitId, branch: null, runAfter);
    }

    public static bool IsVirtual(string id) => id == ExitId || id.EndsWith(EndSuffix, StringComparison.Ordinal);

    public IReadOnlyList<Arc> Next(string id) => _arcs.TryGetValue(id, out var list) ? list : [];

    public bool IsLoop(string id) => _loopNodes.Contains(id);

    /// <summary>Maps a container to its virtual end node so "to container" means "after the container".</summary>
    public static string EndOf(string id) => id + EndSuffix;

    private void Link(string from, string to, string? branch, RunStatus status)
    {
        if (!_arcs.TryGetValue(from, out var list))
        {
            _arcs[from] = list = [];
        }

        if (!list.Any(a => a.To == to && a.Branch == branch))
        {
            list.Add(new Arc(to, branch, status));
        }
    }

    /// <summary>
    /// Wires one action list. Steps with no runAfter inside the block start from <paramref name="entry"/>;
    /// steps nobody runs after flow into <paramref name="exit"/>.
    /// </summary>
    private void WireBlock(ComponentGraph graph, IReadOnlyList<GraphNode> steps, string entry, string exit, string? branch, List<GraphEdge> runAfter)
    {
        if (steps.Count == 0)
        {
            Link(entry, exit, branch, RunStatus.None);
            return;
        }

        var ids = steps.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        var blockEdges = runAfter.Where(e => ids.Contains(e.SourceId) && ids.Contains(e.TargetId)).ToList();
        var allPredecessorEdges = runAfter.Where(e => ids.Contains(e.TargetId)).Select(e => e.TargetId).ToHashSet(StringComparer.Ordinal);
        // A step continues to the block exit unless something runs after its *success*.
        // Steps followed only by failure handlers also end the block when they succeed.
        var hasSuccessor = blockEdges
            .Where(e => e.Status == RunStatus.None || (e.Status & RunStatus.Succeeded) != 0)
            .Select(e => e.SourceId)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var step in steps)
        {
            // A step with runAfter edges that were all filtered out (failure-only) is unreachable: no entry link.
            var declaredRunAfter = graph.Incoming(step.Id, EdgeType.RunsAfter).Any();
            if (!declaredRunAfter)
            {
                Link(entry, step.Id, branch, RunStatus.None);
            }
            else if (!allPredecessorEdges.Contains(step.Id))
            {
                continue;
            }

            var after = StepExit(graph, step, runAfter);
            if (!hasSuccessor.Contains(step.Id))
            {
                Link(after, exit, null, RunStatus.None);
            }
        }

        foreach (var edge in blockEdges)
        {
            var source = steps.First(s => s.Id == edge.SourceId);
            Link(ExitIdOf(source), edge.TargetId, null, edge.Status);
        }
    }

    private static string ExitIdOf(GraphNode node) => node.Type.IsContainer() ? EndOf(node.Id) : node.Id;

    /// <summary>Wires the inside of a step and returns the node to continue from after it.</summary>
    private string StepExit(ComponentGraph graph, GraphNode step, List<GraphEdge> runAfter)
    {
        if (!step.Type.IsContainer())
        {
            return step.Id;
        }

        var end = EndOf(step.Id);
        var children = graph.Children(step.Id).ToList();

        switch (step.Type)
        {
            case NodeType.Condition:
                WireBlock(graph, children.Where(c => c.Branch == "true").ToList(), step.Id, end, "true", runAfter);
                WireBlock(graph, children.Where(c => c.Branch == "else").ToList(), step.Id, end, "else", runAfter);
                break;

            case NodeType.Switch:
                foreach (var group in children.GroupBy(c => c.Branch ?? "default"))
                {
                    WireBlock(graph, group.ToList(), step.Id, end, group.Key, runAfter);
                }

                if (!children.Any(c => c.Branch == "default"))
                {
                    Link(step.Id, end, "default", RunStatus.None);
                }

                if (step.Property("cases") is { } cases)
                {
                    foreach (var emptyCase in cases.Split('|', StringSplitOptions.RemoveEmptyEntries).Where(c => children.All(ch => ch.Branch != c)))
                    {
                        Link(step.Id, end, emptyCase, RunStatus.None);
                    }
                }

                break;

            case NodeType.Loop:
                _loopNodes.Add(step.Id);
                WireBlock(graph, children, step.Id, end, null, runAfter);
                break;

            default:
                WireBlock(graph, children, step.Id, end, null, runAfter);
                break;
        }

        return end;
    }
}
