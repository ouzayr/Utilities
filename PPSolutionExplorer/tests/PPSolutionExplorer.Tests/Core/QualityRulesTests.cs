using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Parsers.Flows;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Core;

public class QualityRulesTests
{
    [Fact]
    public void Sample_flow_findings()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        var graph = ImportParser.Parse(zip, "s.zip").Graph;
        var findings = QualityRules.Evaluate(graph, NodeIds.Flow("11111111-1111-1111-1111-111111111111"));

        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE001"); // Catch scope handles failure.
        Assert.Contains(findings, f => f.RuleId == "PPSE002" && f.NodeId.EndsWith("Terminate"));
        Assert.Contains(findings, f => f.RuleId == "PPSE004");
        Assert.Contains(findings, f => f.RuleId == "PPSE005" && f.NodeId.EndsWith("Run_child_flow"));
        Assert.Contains(findings, f => f.RuleId == "PPSE006" && f.NodeId.EndsWith("Mystery_step"));
        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE007"); // $top is set.
    }

    [Fact]
    public void Flow_without_failure_handler_is_flagged()
    {
        var graph = FlowDefinitionParser.ParseStandalone("""
            { "definition": { "triggers": { "manual": { "type": "Request" } }, "actions": { "A": { "type": "Compose", "inputs": 1 } } } }
            """, "x");
        var flow = graph.Nodes.Single(n => n.Type == NodeType.Flow).Id;
        Assert.Contains(QualityRules.Evaluate(graph, flow), f => f.RuleId == "PPSE001");
    }
}
