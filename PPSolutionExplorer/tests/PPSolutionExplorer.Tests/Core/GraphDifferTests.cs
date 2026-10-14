using PPSolutionExplorer.Core.Diff;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Core;

public class GraphDifferTests
{
    private static readonly string FlowId = NodeIds.Flow("11111111-1111-1111-1111-111111111111");

    private static ComponentGraph Load(string folder)
    {
        using var zip = Fixtures.ZipFolder($"solutions/{folder}");
        return ImportParser.Parse(zip, folder + ".zip").Graph;
    }

    private static string Step(string name) => NodeIds.Action(FlowId, name);

    [Fact]
    public void Identical_imports_have_no_changes()
    {
        var diff = GraphDiffer.Diff(Load("SampleSolution"), Load("SampleSolution"));
        Assert.True(diff.Summary.IsEmpty);
    }

    [Fact]
    public void Detects_added_removed_changed_and_moved_steps()
    {
        var diff = GraphDiffer.Diff(Load("SampleSolution"), Load("SampleSolution_v2"), FlowId);

        Assert.Contains(diff.Nodes, n => n.NodeId == Step("Log_result") && n.Kind == ChangeKind.Added);
        Assert.Contains(diff.Nodes, n => n.NodeId == Step("Compose_missing_email") && n.Kind == ChangeKind.Removed);

        var changed = Assert.Single(diff.Nodes, n => n.NodeId == Step("List_contacts"));
        Assert.Equal(ChangeKind.Changed, changed.Kind);
        var filter = Assert.Single(changed.Changes);
        Assert.Equal("inputs/parameters/$filter", filter.Path);
        Assert.EndsWith("statecode eq 0", filter.Before);
        Assert.EndsWith("statecode eq 1", filter.After);

        var moved = Assert.Single(diff.Nodes, n => n.NodeId == Step("Call_API"));
        Assert.Equal(ChangeKind.Moved, moved.Kind);
        Assert.Contains(moved.Changes, c => c.Path == "parent" && c.Before == "Try" && c.After == "Account Sync");

        Assert.Contains(diff.Edges, e => e.SourceId == Step("Try") && e.TargetId == Step("Catch") && e.Kind == ChangeKind.Changed && e.After!.Contains("Skipped"));
        Assert.Contains(diff.Edges, e => e.TargetId == Step("Log_result") && e.Type == EdgeType.RunsAfter && e.Kind == ChangeKind.Added);
    }

    [Fact]
    public void Solution_level_diff_includes_version_change_and_leaves_other_flows_alone()
    {
        var diff = GraphDiffer.Diff(Load("SampleSolution"), Load("SampleSolution_v2"));

        var solution = Assert.Single(diff.Nodes, n => n.Type == NodeType.Solution);
        Assert.Contains(solution.Changes, c => c.Path == "property:version" && c.Before == "1.0.0.3" && c.After == "1.0.0.4");
        Assert.DoesNotContain(diff.Nodes, n => n.FlowId == NodeIds.Flow("22222222-2222-2222-2222-222222222222"));
    }

    [Fact]
    public void Designer_noise_is_ignored()
    {
        var before = Parse("""{ "type": "Compose", "inputs": 1, "metadata": { "operationMetadataId": "aaaaaaaa-0000-0000-0000-000000000000" } }""");
        var after = Parse("""{ "type": "Compose", "inputs": 1, "metadata": { "operationMetadataId": "bbbbbbbb-0000-0000-0000-000000000000" } }""");
        Assert.True(GraphDiffer.Diff(before, after).Summary.IsEmpty);

        static ComponentGraph Parse(string action) => PPSolutionExplorer.Parsers.Flows.FlowDefinitionParser.ParseStandalone(
            $$"""{ "name": "f", "definition": { "triggers": { "manual": { "type": "Request" } }, "actions": { "A": {{action}} } } }""", "f");
    }
}
