using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Parsers.Flows;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Core;

public class QualityRulesTests
{
    private static (ComponentGraph Graph, string FlowId) Cases()
    {
        var graph = FlowDefinitionParser.ParseStandalone(Fixtures.Read("flows/quality-cases.json"), "cases");
        return (graph, graph.Nodes.Single(n => n.Type == NodeType.Flow).Id);
    }

    private static string Step(string flowId, string name) => NodeIds.Action(flowId, name);

    [Fact]
    public void Sample_flow_findings()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        var graph = ImportParser.Parse(zip, "s.zip").Graph;
        var flowId = NodeIds.Flow("11111111-1111-1111-1111-111111111111");
        var findings = QualityRules.Evaluate(graph, flowId);

        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE001"); // Catch scope handles failure.
        Assert.Contains(findings, f => f.RuleId == "PPSE002" && f.NodeId.EndsWith("Terminate"));
        Assert.Contains(findings, f => f.RuleId == "PPSE004" && f.NodeId == Step(flowId, "Call_API"));
        Assert.Contains(findings, f => f.RuleId == "PPSE008" && f.NodeId == Step(flowId, "Mystery_step") && f.Severity == Severity.Error);
        Assert.Contains(findings, f => f.RuleId == "PPSE005" && f.NodeId.EndsWith("Run_child_flow"));
        Assert.Contains(findings, f => f.RuleId == "PPSE006" && f.NodeId.EndsWith("Mystery_step"));
        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE007"); // $top is set.
        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE009"); // status is read.
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

    [Fact]
    public void Unused_variables_and_outputs()
    {
        var (graph, flowId) = Cases();
        var findings = QualityRules.Evaluate(graph, flowId);

        Assert.Contains(findings, f => f.RuleId == "PPSE009" && f.NodeId == Step(flowId, "Init_unused"));
        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE009" && f.NodeId == Step(flowId, "Init_used"));
        Assert.Contains(findings, f => f.RuleId == "PPSE010" && f.NodeId == Step(flowId, "Dead_compose"));
        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE010" && f.NodeId == Step(flowId, "Bad_ref"));
    }

    [Fact]
    public void Broken_references_are_errors()
    {
        var (graph, flowId) = Cases();
        var broken = QualityRules.Evaluate(graph, flowId).Where(f => f.RuleId == "PPSE008").ToList();

        Assert.Equal(2, broken.Count(f => f.NodeId == Step(flowId, "Bad_ref")));
        Assert.All(broken, f => Assert.Equal(Severity.Error, f.Severity));
    }

    [Fact]
    public void Sequential_loop_only_when_safe_to_parallelise()
    {
        var (graph, flowId) = Cases();
        var loops = QualityRules.Evaluate(graph, flowId).Where(f => f.RuleId == "PPSE011").Select(f => f.NodeId).ToList();

        Assert.Equal([Step(flowId, "Loop_items")], loops); // parallel loop has concurrency; counter loop must stay sequential
    }

    [Fact]
    public void Literal_secret_and_url_are_flagged_without_echoing_the_secret()
    {
        var (graph, flowId) = Cases();
        var findings = QualityRules.Evaluate(graph, flowId);

        var secret = Assert.Single(findings, f => f.RuleId == "PPSE012");
        Assert.Equal(Step(flowId, "Call_with_key"), secret.NodeId);
        Assert.DoesNotContain("plain-text-key-123", secret.Message + secret.Evidence);
        Assert.Contains(findings, f => f.RuleId == "PPSE013" && f.NodeId == Step(flowId, "Call_with_key"));
    }

    [Fact]
    public void Profile_can_disable_and_regrade_rules()
    {
        var (graph, flowId) = Cases();
        var profile = new QualityProfile
        {
            Rules =
            {
                ["PPSE010"] = new RuleSetting { Enabled = false },
                ["PPSE009"] = new RuleSetting { Severity = Severity.Error },
            },
            MaxActions = 5,
        };
        var findings = QualityRules.Evaluate(graph, flowId, profile);

        Assert.DoesNotContain(findings, f => f.RuleId == "PPSE010");
        Assert.All(findings.Where(f => f.RuleId == "PPSE009"), f => Assert.Equal(Severity.Error, f.Severity));
        Assert.Contains(findings, f => f.RuleId == "PPSE014");
    }

    [Fact]
    public void Options_resolve_named_profiles()
    {
        var options = new QualityOptions { Profiles = { ["strict"] = new QualityProfile { MaxNestingDepth = 3 } } };
        Assert.Equal(3, options.Resolve("strict").MaxNestingDepth);
        Assert.Equal(6, options.Resolve(null).MaxNestingDepth);
        Assert.Throws<ArgumentException>(() => options.Resolve("missing"));
    }

    [Fact]
    public void Every_rule_in_catalog_is_unique() =>
        Assert.Equal(QualityRules.Catalog.Count, QualityRules.Catalog.Select(r => r.Id).Distinct().Count());

    [Fact]
    public void Complexity_score_for_sample()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        var graph = ImportParser.Parse(zip, "s.zip").Graph;
        var c = ComplexityCalculator.Calculate(graph, NodeIds.Flow("11111111-1111-1111-1111-111111111111"));

        Assert.Equal(14, c.Actions);
        Assert.Equal(5, c.Containers);
        Assert.Equal(5, c.Branches); // condition (2) + switch with 2 cases + default (3)
        Assert.Equal(4, c.MaxDepth); // Try > For_each > Has_email > Update_contact
        Assert.Equal(8, c.Paths);
        Assert.True(c.Expressions > 5);
        Assert.Equal("Medium", c.Rating);
    }
}
