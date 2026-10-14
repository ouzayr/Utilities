using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Paths;
using PPSolutionExplorer.Core.Search;
using PPSolutionExplorer.Parsers;
using PPSolutionExplorer.Persistence;
using PPSolutionExplorer.Persistence.Stores;
using PPSolutionExplorer.Tests.Support;

namespace PPSolutionExplorer.Tests.Persistence;

/// <summary>
/// Runs against a real PostgreSQL (recursive CTEs). Set PPSE_TEST_CONNECTION to enable, e.g.
/// <c>Host=127.0.0.1;Database=ppse_test;Username=ppse;Password=ppse</c>. The database is dropped and recreated.
/// </summary>
[Trait("Category", "Postgres")]
public class GraphStoreTests
{
    private static readonly string? Connection = Environment.GetEnvironmentVariable("PPSE_TEST_CONNECTION");
    private static readonly SemaphoreSlim Lock = new(1, 1);
    private static bool _created;

    private static async Task<ExplorerDbContext> ContextAsync()
    {
        var db = new ExplorerDbContext(new DbContextOptionsBuilder<ExplorerDbContext>().UseNpgsql(Connection).Options);
        await Lock.WaitAsync();
        try
        {
            if (!_created)
            {
                await db.Database.EnsureDeletedAsync();
                await db.Database.MigrateAsync();
                _created = true;
            }
        }
        finally
        {
            Lock.Release();
        }

        return db;
    }

    private static async Task<(GraphStore Store, Guid ImportId, ExplorerDbContext Db)> SeedAsync()
    {
        var db = await ContextAsync();
        var store = new GraphStore(db);
        using var zip = Fixtures.ZipFolder("solutions/SampleSolution");
        var result = ImportParser.Parse(zip, "s.zip");
        var summary = await store.SaveAsync(result.Kind.ToString(), result.Name, result.Version, "s.zip", "sha", result.Graph, CancellationToken.None);
        return (store, summary.Id, db);
    }

    [Fact]
    public async Task Flow_subgraph_round_trips_and_traces_identically()
    {
        if (Connection is null)
        {
            return;
        }

        var (store, importId, db) = await SeedAsync();
        await using var _ = db;
        var flowId = NodeIds.Flow("11111111-1111-1111-1111-111111111111");
        var graph = await store.LoadFlowGraphAsync(importId, flowId, CancellationToken.None);

        Assert.NotNull(graph);
        Assert.Equal(15, graph!.Descendants(flowId).Count()); // trigger + 14 actions
        Assert.Equal(8, PathTracer.Trace(graph, new PathTraceRequest(flowId)).TotalEstimated);
    }

    [Fact]
    public async Task Impact_of_env_variable_and_table()
    {
        if (Connection is null)
        {
            return;
        }

        var (store, importId, db) = await SeedAsync();
        await using var _ = db;
        var flowId = NodeIds.Flow("11111111-1111-1111-1111-111111111111");

        var env = await store.ImpactAsync(importId, NodeIds.EnvVariable("ppse_ApiBaseUrl"), 6, CancellationToken.None);
        Assert.Contains(env.Items, i => i.Node.Id == NodeIds.Action(flowId, "Call_API") && i.Depth == 1);

        var table = await store.ImpactAsync(importId, NodeIds.Table("contact"), 6, CancellationToken.None);
        Assert.Contains(table.Items, i => i.Node.Id == NodeIds.Action(flowId, "Update_contact") && i.Via == "Writes");
        Assert.Contains(table.Items, i => i.Node.Id == NodeIds.Action(flowId, "Has_email") && i.Via == "DataFlow");
        Assert.All(table.Items.Where(i => i.Node.Type == NodeType.Action), i => Assert.Equal("Account Sync", i.FlowName));

        var child = await store.ImpactAsync(importId, NodeIds.Flow("22222222-2222-2222-2222-222222222222"), 6, CancellationToken.None);
        Assert.Contains(child.Items, i => i.Node.Id == NodeIds.Action(flowId, "Run_child_flow") && i.Via == "Calls");
    }

    [Fact]
    public async Task Search_filters_combine()
    {
        if (Connection is null)
        {
            return;
        }

        var (store, importId, db) = await SeedAsync();
        await using var _ = db;
        await new AnnotationStore(db).AddTagAsync(NodeIds.Action(NodeIds.Flow("11111111-1111-1111-1111-111111111111"), "List_contacts"), "Reads-Contacts", "user", CancellationToken.None);

        var byTable = await store.SearchAsync(new SearchQuery { ImportId = importId, Tables = ["contact"] }, CancellationToken.None);
        Assert.Equal(["List_contacts", "Update_contact"], byTable.Select(h => h.Node.Name));

        var byTag = await store.SearchAsync(new SearchQuery { ImportId = importId, Tags = ["reads-contacts"] }, CancellationToken.None);
        Assert.Equal("List_contacts", Assert.Single(byTag).Node.Name);

        var unresolved = await store.SearchAsync(new SearchQuery { ImportId = importId, HasUnresolved = true }, CancellationToken.None);
        Assert.Equal(["Call_API", "Mystery_step"], unresolved.Select(h => h.Node.Name));

        var literal = await store.SearchAsync(new SearchQuery { ImportId = importId, Text = "_%" }, CancellationToken.None);
        Assert.Empty(literal);

        var facets = await store.GetFacetsAsync(importId, CancellationToken.None);
        Assert.Contains("ListRecords", facets.SubTypes);
        Assert.Contains("shared_commondataserviceforapps", facets.Connectors);
    }
}
