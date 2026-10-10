using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Parsers;

public class SolutionZipParserTests
{
    private static ParseResult ParseSample()
    {
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        return ImportParser.Parse(zip, "PpseSample_1_0_0_3.zip");
    }

    [Fact]
    public void Golden_sample_solution()
    {
        var result = ParseSample();
        Assert.Equal(ImportKind.Solution, result.Kind);
        Assert.Equal("1.0.0.3", result.Version);
        Fixtures.AssertGolden("SampleSolution.graph.txt", Fixtures.Canonical(result.Graph));
    }

    [Fact]
    public void Nesting_and_branches_are_kept()
    {
        var graph = ParseSample().Graph;
        var flow = NodeIds.Flow("11111111-1111-1111-1111-111111111111");

        Assert.Equal(NodeType.Condition, graph.Find(NodeIds.Action(flow, "Has_email"))!.Type);
        Assert.Equal("true", graph.Find(NodeIds.Action(flow, "Update_contact"))!.Branch);
        Assert.Equal("else", graph.Find(NodeIds.Action(flow, "Compose_missing_email"))!.Branch);
        Assert.Equal("case:Done", graph.Find(NodeIds.Action(flow, "Run_child_flow"))!.Branch);
        Assert.Equal("default", graph.Find(NodeIds.Action(flow, "Mystery_step"))!.Branch);
    }

    [Fact]
    public void Unknown_action_type_is_kept_with_raw_json()
    {
        var graph = ParseSample().Graph;
        var node = graph.Find(NodeIds.Action(NodeIds.Flow("11111111-1111-1111-1111-111111111111"), "Mystery_step"))!;
        Assert.Equal(NodeType.Unknown, node.Type);
        Assert.Equal("SomeFutureActionType", node.SubType);
        Assert.Contains("Not_an_action", node.RawJson);
    }

    [Fact]
    public void Entity_set_name_maps_to_logical_table()
    {
        var graph = ParseSample().Graph;
        var flow = NodeIds.Flow("11111111-1111-1111-1111-111111111111");
        var update = NodeIds.Action(flow, "Update_contact");

        Assert.Contains(graph.Edges, e => e.SourceId == update && e.TargetId == NodeIds.Table("contact") && e.Type == EdgeType.Writes);
        Assert.Contains(graph.Edges, e => e.SourceId == update && e.TargetId == NodeIds.Column("contact", "description") && e.Type == EdgeType.Writes);
        Assert.Contains(graph.Edges, e => e.TargetId == NodeIds.Column("contact", "statecode") && e.Type == EdgeType.Reads);
        Assert.Contains(graph.Edges, e => e.SourceId == NodeIds.Table("account") && e.TargetId == flow && e.Type == EdgeType.Triggers);
    }

    [Fact]
    public void Dynamic_references_are_unresolved_not_guessed()
    {
        var graph = ParseSample().Graph;
        var callApi = NodeIds.Action(NodeIds.Flow("11111111-1111-1111-1111-111111111111"), "Call_API");

        Assert.Contains(graph.Unresolved, u => u.NodeId == callApi && u.RawExpression.Contains("body(variables('status'))"));
        Assert.Contains(graph.Edges, e => e.SourceId == callApi && e.TargetId == NodeIds.EnvVariable("ppse_ApiBaseUrl") && e.Type == EdgeType.UsesEnvVar);
    }

    [Fact]
    public void Child_flow_call_links_to_flow_in_solution()
    {
        var graph = ParseSample().Graph;
        var child = graph.Find(NodeIds.Flow("22222222-2222-2222-2222-222222222222"))!;
        Assert.False(child.IsPlaceholder);
        Assert.Contains(graph.Edges, e => e.TargetId == child.Id && e.Type == EdgeType.Calls);
    }

    [Fact]
    public void Non_cloud_flow_workflows_are_reported_not_parsed()
    {
        var graph = ParseSample().Graph;
        Assert.Contains(graph.Warnings, w => w.Contains("Legacy business rule"));
        Assert.Null(graph.Find(NodeIds.Flow("33333333-3333-3333-3333-333333333333")));
    }

    [Fact]
    public void Rejects_unrecognised_archive()
    {
        using var memory = new MemoryStream();
        using (var zip = new System.IO.Compression.ZipArchive(memory, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
        {
            zip.CreateEntry("readme.txt");
        }

        memory.Position = 0;
        Assert.Throws<InvalidDataException>(() => ImportParser.Parse(memory, "x.zip"));
    }
}
