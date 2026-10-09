using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Paths;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Parsers.Flows;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Core;

public class PathTracerTests
{
    private static (ComponentGraph Graph, string FlowId) Parallel()
    {
        var graph = FlowDefinitionParser.ParseStandalone(Fixtures.Read("flows/parallel-branches.json"), "parallel");
        return (graph, graph.Nodes.Single(n => n.Type == NodeType.Flow).Id);
    }

    private static (ComponentGraph Graph, string FlowId) Sample()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        var graph = ImportParser.Parse(zip, "s.zip").Graph;
        return (graph, NodeIds.Flow("11111111-1111-1111-1111-111111111111"));
    }

    [Fact]
    public void Parallel_branches_give_one_path_each()
    {
        var (graph, flow) = Parallel();
        var result = PathTracer.Trace(graph, new PathTraceRequest(flow));

        // Trigger > A > {B|C} > D > (end | OnFail)
        Assert.Equal(4, result.TotalEstimated);
        Assert.Equal(4, result.Returned);
        Assert.False(result.Truncated);
        Assert.Equal(2, result.Paths.Count(p => p.UsesFailureBranch));
    }

    [Fact]
    public void Failure_branches_can_be_excluded()
    {
        var (graph, flow) = Parallel();
        var result = PathTracer.Trace(graph, new PathTraceRequest(flow, IncludeFailureBranches: false));
        Assert.Equal(2, result.TotalEstimated);
        Assert.All(result.Paths, p => Assert.False(p.UsesFailureBranch));
    }

    [Fact]
    public void Cap_truncates_but_count_stays_exact()
    {
        var (graph, flow) = Parallel();
        var result = PathTracer.Trace(graph, new PathTraceRequest(flow, MaxPaths: 1));
        Assert.Equal(4, result.TotalEstimated);
        Assert.Equal(1, result.Returned);
        Assert.True(result.Truncated);
    }

    [Fact]
    public void Nested_sample_flow_paths()
    {
        var (graph, flow) = Sample();
        var result = PathTracer.Trace(graph, new PathTraceRequest(flow));

        // Try: true|else (2) -> then Catch path (Try failed: 1 path, Catch internal sequential) or Switch (Done|Pending|default = 3).
        // Failure branch: Try entered and fails anywhere is modelled as Try#end -> Catch: 2 inner paths × 1 = 2.
        // Success: 2 inner paths × 3 switch branches = 6.
        Assert.Equal(8, result.TotalEstimated);
        Assert.All(result.Paths, p => Assert.True(p.Iterated));
        Assert.Contains(result.Paths, p => p.Steps.Any(s => s.Branch == "else"));
        Assert.Contains(result.Paths, p => p.Steps.Any(s => s.NodeId.EndsWith("Mystery_step")));
    }

    [Fact]
    public void Trace_between_two_steps()
    {
        var (graph, flow) = Sample();
        var result = PathTracer.Trace(graph, new PathTraceRequest(flow,
            FromNodeId: NodeIds.Action(flow, "List_contacts"),
            ToNodeId: NodeIds.Action(flow, "Update_contact")));

        var path = Assert.Single(result.Paths);
        Assert.Equal(["List_contacts", "For_each_contact", "Has_email", "Update_contact"],
            path.Steps.Select(s => s.NodeId.Split(':').Last()));
    }

    [Fact]
    public void Property_dp_count_equals_enumerated_count_on_random_dags()
    {
        var random = new Random(12345);
        for (var iteration = 0; iteration < 200; iteration++)
        {
            var graph = RandomFlow(random, out var flowId);
            var result = PathTracer.Trace(graph, new PathTraceRequest(flowId, MaxPaths: 100_000));
            Assert.False(result.Truncated);
            Assert.Equal(result.TotalEstimated, result.Returned);
            Assert.Equal(result.Paths.Count, result.Paths.Select(p => string.Join(">", p.Steps.Select(s => s.NodeId + s.Branch))).Distinct().Count());
        }
    }

    /// <summary>Random flow: a DAG of runAfter edges, with some steps being conditions holding nested blocks.</summary>
    private static ComponentGraph RandomFlow(Random random, out string flowId)
    {
        var graph = new ComponentGraph();
        var flow = NodeIds.Flow(Guid.NewGuid().ToString());
        flowId = flow;
        graph.Add(new GraphNode(flow, NodeType.Flow, "random"));
        graph.Add(new GraphNode(NodeIds.Trigger(flow, "t"), NodeType.Trigger, "t", flow));
        var counter = 0;
        AddBlock(flow, null, depth: 0);
        return graph;

        void AddBlock(string parentId, string? branch, int depth)
        {
            var size = random.Next(1, 5);
            var ids = new List<string>();
            for (var i = 0; i < size; i++)
            {
                var isCondition = depth < 2 && random.NextDouble() < 0.3;
                var id = NodeIds.Action(flow, $"s{counter++}");
                graph.Add(new GraphNode(id, isCondition ? NodeType.Condition : NodeType.Action, id, parentId, branch, Order: counter));

                // Each step runs after 0..2 earlier siblings: forks and joins, never cycles.
                if (ids.Count > 0)
                {
                    foreach (var predecessor in ids.OrderBy(_ => random.Next()).Take(random.Next(1, Math.Min(2, ids.Count) + 1)))
                    {
                        var status = random.NextDouble() < 0.2 ? RunStatus.Failed : RunStatus.Succeeded;
                        graph.AddEdge(new GraphEdge(predecessor, id, EdgeType.RunsAfter, status));
                    }
                }

                ids.Add(id);
                if (isCondition)
                {
                    AddBlock(id, "true", depth + 1);
                    if (random.NextDouble() < 0.7)
                    {
                        AddBlock(id, "else", depth + 1);
                    }
                }
            }
        }
    }
}
