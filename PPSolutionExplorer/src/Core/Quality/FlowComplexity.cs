using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Paths;

namespace PPSolutionExplorer.Core.Quality;

/// <param name="Score">actions + 2·branches + 5·maxDepth + 0.5·expressions + 10·log10(paths + 1), rounded.</param>
/// <param name="Rating">Low (&lt; 50), Medium (&lt; 150), High (&lt; 400), VeryHigh.</param>
public sealed record FlowComplexity(
    string FlowId,
    int Actions,
    int Containers,
    int Branches,
    int MaxDepth,
    int Expressions,
    long Paths,
    int Score,
    string Rating);

public static class ComplexityCalculator
{
    public static FlowComplexity Calculate(ComponentGraph graph, string flowId)
    {
        var steps = graph.Descendants(flowId).Where(n => n.Type.IsFlowStep()).ToList();
        var actions = steps.Count(s => s.Type != NodeType.Trigger);
        var containers = steps.Count(s => s.Type.IsContainer());

        // Every distinct branch label under a condition/switch counts; a condition always has two outcomes.
        var branches = steps.Where(s => s.Type is NodeType.Condition or NodeType.Switch).Sum(s =>
            s.Type == NodeType.Condition ? 2 : Math.Max(1, (s.Property("cases")?.Split('|').Length ?? 0) + 1));

        var maxDepth = steps.Count == 0 ? 0 : steps.Max(s => QualityRules.Depth(graph, flowId, s)) + 1;
        var expressions = steps.Sum(s => int.TryParse(s.Property(NodeProperties.ExpressionCount), out var n) ? n : 0);
        var paths = PathTracer.Trace(graph, new PathTraceRequest(flowId, MaxPaths: 0)).TotalEstimated;

        var score = (int)Math.Round(actions + 2.0 * branches + 5.0 * maxDepth + 0.5 * expressions + 10 * Math.Log10(paths + 1.0));
        var rating = score switch
        {
            < 50 => "Low",
            < 150 => "Medium",
            < 400 => "High",
            _ => "VeryHigh",
        };

        return new FlowComplexity(flowId, actions, containers, branches, maxDepth, expressions, paths, score, rating);
    }
}
