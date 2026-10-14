using System.Diagnostics;
using System.Text.Json.Nodes;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Paths;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Parsers.Flows;

namespace PPSolutionExplorer.Tests.Core;

/// <summary>Non-functional requirement: flows with hundreds (here ~2,000) of actions stay fast.</summary>
public class LargeFlowTests
{
    [Fact]
    public void Parse_trace_rules_and_complexity_on_two_thousand_steps()
    {
        var json = BuildFlow(scopes: 100, stepsPerScope: 18);
        var stopwatch = Stopwatch.StartNew();

        var graph = FlowDefinitionParser.ParseStandalone(json, "large");
        var flowId = graph.Nodes.Single(n => n.Type == NodeType.Flow).Id;
        var trace = PathTracer.Trace(graph, new PathTraceRequest(flowId, MaxPaths: 1_000));
        var findings = QualityRules.Evaluate(graph, flowId);
        var complexity = ComplexityCalculator.Calculate(graph, flowId);

        stopwatch.Stop();
        Assert.True(graph.Nodes.Count > 2_000);
        Assert.Equal(1_000, trace.Returned);
        Assert.True(trace.Truncated);
        Assert.True(trace.TotalEstimated > 1_000_000); // 2 branches per scope, 100 scopes in sequence: saturates
        Assert.NotEmpty(findings);
        Assert.Equal("VeryHigh", complexity.Rating);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(10), $"took {stopwatch.Elapsed}");
    }

    /// <summary>Sequential scopes, each with a condition holding two branches of composes.</summary>
    private static string BuildFlow(int scopes, int stepsPerScope)
    {
        var actions = new JsonObject();
        for (var s = 0; s < scopes; s++)
        {
            var inner = new JsonObject();
            var yes = new JsonObject();
            var no = new JsonObject();
            for (var i = 0; i < stepsPerScope / 2; i++)
            {
                yes[$"Yes_{s}_{i}"] = Step(i == 0 ? null : $"Yes_{s}_{i - 1}");
                no[$"No_{s}_{i}"] = Step(i == 0 ? null : $"No_{s}_{i - 1}");
            }

            inner[$"Check_{s}"] = new JsonObject
            {
                ["type"] = "If",
                ["expression"] = new JsonObject { ["equals"] = new JsonArray("@triggerBody()?['x']", s) },
                ["actions"] = yes,
                ["else"] = new JsonObject { ["actions"] = no },
            };
            actions[$"Scope_{s}"] = new JsonObject
            {
                ["type"] = "Scope",
                ["actions"] = inner,
                ["runAfter"] = s == 0 ? new JsonObject() : new JsonObject { [$"Scope_{s - 1}"] = new JsonArray("Succeeded") },
            };
        }

        return new JsonObject
        {
            ["definition"] = new JsonObject
            {
                ["triggers"] = new JsonObject { ["manual"] = new JsonObject { ["type"] = "Request" } },
                ["actions"] = actions,
            },
        }.ToJsonString();

        static JsonObject Step(string? after) => new()
        {
            ["type"] = "Compose",
            ["inputs"] = "@triggerBody()",
            ["runAfter"] = after is null ? new JsonObject() : new JsonObject { [after] = new JsonArray("Succeeded") },
        };
    }
}
