using PPSolutionExplorer.Api.Docs;
using PPSolutionExplorer.Api.Endpoints;
using PPSolutionExplorer.Api.Inventory;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Parsers.Flows;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Api;

public class ReportingTests
{
    private static readonly string FlowId = NodeIds.Flow("11111111-1111-1111-1111-111111111111");

    private static ComponentGraph Sample()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        return ImportParser.Parse(zip, "s.zip").Graph;
    }

    [Fact]
    public void Inventory_lists_connectors_premium_and_complexity()
    {
        var report = InventoryBuilder.Build(Sample(), new InventoryOptions());

        var dataverse = Assert.Single(report.Connectors, c => c.Connector == "shared_commondataserviceforapps");
        Assert.True(dataverse.Premium);
        Assert.Equal(["ppse_sharedcommondataserviceforapps_0001"], dataverse.ConnectionReferences);
        Assert.Equal(3, dataverse.Steps); // trigger, List_contacts, Update_contact
        Assert.Contains(report.Connectors, c => c.Connector == InventoryBuilder.HttpKey && c.Premium);
        Assert.Contains(report.Connectors, c => c.Connector == "shared_office365" && !c.Premium);

        var flow = Assert.Single(report.Flows, f => f.FlowId == FlowId);
        Assert.True(flow.UsesPremium);
        Assert.Equal("Medium", flow.Complexity.Rating);
    }

    [Fact]
    public void Configured_lists_replace_defaults_and_flag_deprecated_operations()
    {
        var options = new InventoryOptions { PremiumConnectors = ["shared_office365"], DeprecatedOperations = ["shared_office365/SendEmailV2", "type:Terminate"] };
        var report = InventoryBuilder.Build(Sample(), options);

        Assert.False(report.Connectors.Single(c => c.Connector == "shared_commondataserviceforapps").Premium);
        Assert.True(report.Connectors.Single(c => c.Connector == "shared_office365").Premium);
        Assert.Contains(report.Deprecated, d => d.StepName == "Notify_admin");
        Assert.Contains(report.Deprecated, d => d.StepName == "Terminate");
    }

    [Fact]
    public void Mermaid_has_subgraphs_lanes_and_failure_edges()
    {
        var mermaid = MermaidBuilder.Build(Sample(), FlowId)!;

        Assert.StartsWith("flowchart TD", mermaid);
        Assert.Contains("[\"Try (Scope)\"]", mermaid);
        Assert.Contains("[\"else\"]", mermaid);
        Assert.Contains("-.->|Failed TimedOut|", mermaid);
        Assert.Contains(":::unknown", mermaid);
        Assert.Equal(mermaid.Split("subgraph").Length - 1, mermaid.Split("\n").Count(l => l.Trim() == "end"));
    }

    [Fact]
    public void Expressions_are_listed_with_paths_and_references()
    {
        var graph = Sample();
        var list = Expressions.Of(graph.Find(NodeIds.Action(FlowId, "List_contacts"))!);

        var filter = Assert.Single(list, e => e.Path == "inputs/parameters/$filter");
        Assert.Contains(filter.References, r => r.Kind == PPSolutionExplorer.Parsers.Expressions.ReferenceKind.Trigger);
        Assert.Equal(Enumerable.Range(0, list.Count), list.Select(e => e.Index));
    }

    [Fact]
    public void Invalid_flow_json_gives_line_and_position()
    {
        var ex = Assert.Throws<InvalidDataException>(() => FlowDefinitionParser.ParseStandalone("{\n  \"definition\": {\n    \"triggers\": ,\n}", "broken.json"));
        Assert.Contains("broken.json", ex.Message);
        Assert.Contains("line 3", ex.Message);
    }

    [Fact]
    public void Unexpected_schema_version_is_warned_not_fatal()
    {
        var graph = FlowDefinitionParser.ParseStandalone("""
            { "definition": { "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2030-01-01/workflowdefinition.json#",
              "triggers": { "manual": { "type": "Request" } }, "actions": { "A": { "type": "Compose", "inputs": 1 } } } }
            """, "future");
        Assert.Contains(graph.Warnings, w => w.Contains("2030-01-01"));
        Assert.Contains(graph.Nodes, n => n.Name == "A");
    }
}
