using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Search;
using PPSolutionExplorer.Persistence.Entities;

namespace PPSolutionExplorer.Persistence.Stores;

/// <summary>Persists parsed graphs and answers graph queries (recursive CTEs in PostgreSQL).</summary>
public sealed class GraphStore(ExplorerDbContext db)
{
    public async Task<ImportSummary> SaveAsync(string kind, string name, string? version, string fileName, string sha256, ComponentGraph graph, CancellationToken ct)
    {
        var import = new ImportEntity
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            Name = name,
            Version = version,
            FileName = fileName,
            Sha256 = sha256,
            ImportedAt = DateTimeOffset.UtcNow,
            Warnings = graph.Warnings.ToList(),
            NodeCount = graph.Nodes.Count,
            EdgeCount = graph.Edges.Count,
            UnresolvedCount = graph.Unresolved.Count,
        };

        db.Imports.Add(import);
        db.Nodes.AddRange(graph.Nodes.Select(n => new NodeEntity
        {
            ImportId = import.Id,
            Id = n.Id,
            Type = n.Type.ToString(),
            Name = n.Name,
            ParentId = n.ParentId,
            Branch = n.Branch,
            SubType = n.SubType,
            Connector = n.Property(NodeProperties.ConnectorId),
            Operation = n.Property(NodeProperties.OperationId),
            RawJson = n.RawJson,
            Properties = n.Properties?.ToDictionary() ?? [],
            Order = n.Order,
        }));
        db.Edges.AddRange(graph.Edges.Select(e => new EdgeEntity
        {
            ImportId = import.Id,
            SourceId = e.SourceId,
            TargetId = e.TargetId,
            Type = e.Type.ToString(),
            Status = (int)e.Status,
            Expression = e.Expression,
        }));
        db.Unresolved.AddRange(graph.Unresolved.Select(u => new UnresolvedEntity
        {
            ImportId = import.Id,
            NodeId = u.NodeId,
            RawExpression = u.RawExpression,
            Reason = u.Reason,
        }));

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
        return ToSummary(import);
    }

    public async Task<IReadOnlyList<ImportSummary>> ListImportsAsync(CancellationToken ct) =>
        (await db.Imports.AsNoTracking().OrderByDescending(i => i.ImportedAt).ToListAsync(ct)).Select(ToSummary).ToList();

    public async Task<ImportSummary?> GetImportAsync(Guid id, CancellationToken ct) =>
        await db.Imports.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, ct) is { } import ? ToSummary(import) : null;

    /// <summary>Deletes our copy of an import. Tags and notes (keyed by node ID) are kept for re-imports.</summary>
    public async Task<bool> DeleteImportAsync(Guid id, CancellationToken ct) =>
        await db.Imports.Where(i => i.Id == id).ExecuteDeleteAsync(ct) > 0;

    public async Task<IReadOnlyList<NodeSummary>> ListNodesAsync(Guid importId, NodeType type, CancellationToken ct)
    {
        var typeName = type.ToString();
        var nodes = await db.Nodes.AsNoTracking()
            .Where(n => n.ImportId == importId && n.Type == typeName)
            .OrderBy(n => n.Name)
            .ToListAsync(ct);
        return await WithTagsAsync(nodes, ct);
    }

    public async Task<NodeEntity?> GetNodeAsync(Guid importId, string nodeId, CancellationToken ct) =>
        await db.Nodes.AsNoTracking().FirstOrDefaultAsync(n => n.ImportId == importId && n.Id == nodeId, ct);

    public async Task<(List<EdgeEntity> Outgoing, List<EdgeEntity> Incoming, List<UnresolvedEntity> Unresolved)> GetNodeLinksAsync(Guid importId, string nodeId, CancellationToken ct)
    {
        var outgoing = await db.Edges.AsNoTracking().Where(e => e.ImportId == importId && e.SourceId == nodeId).ToListAsync(ct);
        var incoming = await db.Edges.AsNoTracking().Where(e => e.ImportId == importId && e.TargetId == nodeId).ToListAsync(ct);
        var unresolved = await db.Unresolved.AsNoTracking().Where(u => u.ImportId == importId && u.NodeId == nodeId).ToListAsync(ct);
        return (outgoing, incoming, unresolved);
    }

    /// <summary>Loads the whole import as an in-memory graph.</summary>
    public async Task<ComponentGraph> LoadGraphAsync(Guid importId, CancellationToken ct)
    {
        var nodes = await db.Nodes.AsNoTracking().Where(n => n.ImportId == importId).ToListAsync(ct);
        var edges = await db.Edges.AsNoTracking().Where(e => e.ImportId == importId).ToListAsync(ct);
        var unresolved = await db.Unresolved.AsNoTracking().Where(u => u.ImportId == importId).ToListAsync(ct);
        return new ComponentGraph(nodes.Select(ToModel), edges.Select(ToModel), unresolved.Select(ToModel));
    }

    /// <summary>Loads one flow (all nested steps via a recursive CTE) plus every edge touching it.</summary>
    public async Task<ComponentGraph?> LoadFlowGraphAsync(Guid importId, string flowId, CancellationToken ct)
    {
        var nodes = await db.Nodes.FromSqlInterpolated($"""
            WITH RECURSIVE tree AS (
                SELECT n.id FROM nodes n WHERE n.import_id = {importId} AND n.id = {flowId}
                UNION
                SELECT c.id FROM nodes c JOIN tree t ON c.parent_id = t.id WHERE c.import_id = {importId}
            )
            SELECT * FROM nodes WHERE import_id = {importId} AND id IN (SELECT id FROM tree)
            """).AsNoTracking().ToListAsync(ct);

        if (!nodes.Any(n => n.Id == flowId && n.Type == nameof(NodeType.Flow)))
        {
            return null;
        }

        var ids = nodes.Select(n => n.Id).ToList();
        var edges = await db.Edges.AsNoTracking()
            .Where(e => e.ImportId == importId && (ids.Contains(e.SourceId) || ids.Contains(e.TargetId)))
            .ToListAsync(ct);

        var externalIds = edges.SelectMany(e => new[] { e.SourceId, e.TargetId }).Except(ids).Distinct().ToList();
        var external = await db.Nodes.AsNoTracking().Where(n => n.ImportId == importId && externalIds.Contains(n.Id)).ToListAsync(ct);
        var unresolved = await db.Unresolved.AsNoTracking().Where(u => u.ImportId == importId && ids.Contains(u.NodeId)).ToListAsync(ct);

        return new ComponentGraph(nodes.Concat(external).Select(ToModel), edges.Select(ToModel), unresolved.Select(ToModel));
    }

    public async Task<SearchFacets> GetFacetsAsync(Guid? importId, CancellationToken ct)
    {
        var nodes = db.Nodes.AsNoTracking().Where(n => importId == null || n.ImportId == importId);
        var subTypes = await nodes.Where(n => n.SubType != null).Select(n => n.SubType!)
            .Union(nodes.Where(n => n.Operation != null).Select(n => n.Operation!)).Distinct().OrderBy(s => s).ToListAsync(ct);
        var connectors = await nodes.Where(n => n.Type == nameof(NodeType.Connector)).Select(n => n.Name).Distinct().OrderBy(s => s).ToListAsync(ct);
        var tables = await nodes.Where(n => n.Type == nameof(NodeType.Table)).Select(n => n.Name).Distinct().OrderBy(s => s).ToListAsync(ct);
        var flows = await nodes.Where(n => n.Type == nameof(NodeType.Flow)).Select(n => n.Id).Distinct().ToListAsync(ct);
        var tags = await db.Tags.AsNoTracking().Select(t => t.Tag).Distinct().OrderBy(t => t).ToListAsync(ct);
        return new SearchFacets(subTypes, connectors, tables, tags, flows);
    }

    /// <summary>Executes a structured query. All values are bound as parameters; no SQL text is built from input.</summary>
    public async Task<IReadOnlyList<SearchHit>> SearchAsync(SearchQuery query, CancellationToken ct)
    {
        var nodes = db.Nodes.AsNoTracking().AsQueryable();
        if (query.ImportId is { } importId)
        {
            nodes = nodes.Where(n => n.ImportId == importId);
        }

        if (!string.IsNullOrWhiteSpace(query.Text))
        {
            var pattern = "%" + EscapeLike(query.Text) + "%";
            nodes = query.SearchRawJson
                ? nodes.Where(n => EF.Functions.ILike(n.Name, pattern, "\\") || EF.Functions.ILike(n.SubType ?? "", pattern, "\\") ||
                                   EF.Functions.ILike(n.Operation ?? "", pattern, "\\") || EF.Functions.ILike(n.RawJson ?? "", pattern, "\\"))
                : nodes.Where(n => EF.Functions.ILike(n.Name, pattern, "\\") || EF.Functions.ILike(n.SubType ?? "", pattern, "\\") ||
                                   EF.Functions.ILike(n.Operation ?? "", pattern, "\\"));
        }

        if (query.NodeTypes.Count > 0)
        {
            var types = query.NodeTypes.Select(t => t.ToString()).ToList();
            nodes = nodes.Where(n => types.Contains(n.Type));
        }

        if (query.SubTypes.Count > 0)
        {
            var subTypes = query.SubTypes.ToList();
            nodes = nodes.Where(n => (n.SubType != null && subTypes.Contains(n.SubType)) || (n.Operation != null && subTypes.Contains(n.Operation)));
        }

        if (query.Connectors.Count > 0)
        {
            var connectors = query.Connectors.ToList();
            nodes = nodes.Where(n => n.Connector != null && connectors.Contains(n.Connector));
        }

        if (query.Tables.Count > 0)
        {
            var tableIds = query.Tables.Select(t => t.StartsWith("table:", StringComparison.Ordinal) ? t : NodeIds.Table(t)).ToList();
            var accessTypes = new[] { nameof(EdgeType.Reads), nameof(EdgeType.Writes) };
            nodes = nodes.Where(n => db.Edges.Any(e => e.ImportId == n.ImportId && e.SourceId == n.Id &&
                                                       accessTypes.Contains(e.Type) && tableIds.Contains(e.TargetId)));
        }

        if (query.Tags.Count > 0)
        {
            var tags = query.Tags.ToList();
            nodes = nodes.Where(n => db.Tags.Any(t => t.NodeId == n.Id && tags.Contains(t.Tag)));
        }

        if (query.FlowId is { } flowId)
        {
            var prefix = flowId + "/";
            nodes = nodes.Where(n => n.Id.StartsWith(prefix));
        }

        if (query.HasUnresolved is { } hasUnresolved)
        {
            nodes = nodes.Where(n => db.Unresolved.Any(u => u.ImportId == n.ImportId && u.NodeId == n.Id) == hasUnresolved);
        }

        var results = await nodes.OrderBy(n => n.Name).Take(Math.Clamp(query.Limit, 1, 1000)).ToListAsync(ct);
        var summaries = await WithTagsAsync(results, ct);
        var flowNames = await FlowNamesAsync(results, ct);

        return summaries.Select((s, i) =>
        {
            var flowId = FlowIdOf(s.Id);
            return new SearchHit(s, flowId, flowId is null ? null : flowNames.GetValueOrDefault((results[i].ImportId, flowId)));
        }).ToList();
    }

    /// <summary>
    /// Impact analysis: what is affected if <paramref name="nodeId"/> changes. Recursive CTE over reverse
    /// dependency edges (Reads/Writes/UsesEnvVar/UsesConnection/Calls) and forward data edges (DataFlow/Triggers).
    /// A table also expands to its columns.
    /// </summary>
    public async Task<ImpactResult> ImpactAsync(Guid importId, string nodeId, int maxDepth, CancellationToken ct)
    {
        maxDepth = Math.Clamp(maxDepth, 1, 20);
        var rows = await db.Database.SqlQuery<ImpactRow>($"""
            WITH RECURSIVE impacted(id, depth, via) AS (
                SELECT {nodeId}::text, 0, ''::text
                UNION
                SELECT CASE WHEN e.type IN ('DataFlow', 'Triggers', 'Contains') THEN e.target_id ELSE e.source_id END,
                       i.depth + 1,
                       e.type
                FROM impacted i
                JOIN edges e ON e.import_id = {importId} AND (
                       (e.type IN ('Reads', 'Writes', 'UsesEnvVar', 'UsesConnection', 'Calls') AND e.target_id = i.id)
                    OR (e.type IN ('DataFlow', 'Triggers') AND e.source_id = i.id)
                    OR (e.type = 'Contains' AND e.source_id = i.id AND i.id LIKE 'table:%'))
                WHERE i.depth < {maxDepth}
            )
            SELECT DISTINCT ON (id) id AS "Id", depth AS "Depth", via AS "Via"
            FROM impacted
            WHERE id <> {nodeId}
            ORDER BY id, depth, via
            """).ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var nodes = await db.Nodes.AsNoTracking().Where(n => n.ImportId == importId && ids.Contains(n.Id)).ToListAsync(ct);
        var summaries = (await WithTagsAsync(nodes, ct)).ToDictionary(s => s.Id);
        var flowNames = await FlowNamesAsync(nodes, ct);

        var items = rows
            .Where(r => summaries.ContainsKey(r.Id))
            .Select(r =>
            {
                var flowId = FlowIdOf(r.Id) ?? (summaries[r.Id].Type == NodeType.Flow ? r.Id : null);
                return new ImpactItem(summaries[r.Id], r.Depth, r.Via, flowId, flowId is null ? null : flowNames.GetValueOrDefault((importId, flowId)));
            })
            .OrderBy(i => i.Depth).ThenBy(i => i.FlowName).ThenBy(i => i.Node.Name)
            .ToList();

        return new ImpactResult(nodeId, maxDepth, items);
    }

    /// <summary>Step IDs are "{flowId}/action:..." by construction (see <see cref="NodeIds"/>).</summary>
    public static string? FlowIdOf(string nodeId) =>
        nodeId.StartsWith("flow:", StringComparison.Ordinal) && nodeId.IndexOf('/') is var slash and > 0 ? nodeId[..slash] : null;

    private async Task<Dictionary<(Guid, string), string>> FlowNamesAsync(IEnumerable<NodeEntity> nodes, CancellationToken ct)
    {
        var flowIds = nodes.Select(n => FlowIdOf(n.Id) ?? (n.Type == nameof(NodeType.Flow) ? n.Id : null)).OfType<string>().Distinct().ToList();
        var importIds = nodes.Select(n => n.ImportId).Distinct().ToList();
        return await db.Nodes.AsNoTracking()
            .Where(n => importIds.Contains(n.ImportId) && flowIds.Contains(n.Id))
            .ToDictionaryAsync(n => (n.ImportId, n.Id), n => n.Name, ct);
    }

    private async Task<IReadOnlyList<NodeSummary>> WithTagsAsync(IReadOnlyList<NodeEntity> nodes, CancellationToken ct)
    {
        var ids = nodes.Select(n => n.Id).Distinct().ToList();
        var tags = await db.Tags.AsNoTracking().Where(t => ids.Contains(t.NodeId)).ToListAsync(ct);
        var lookup = tags.ToLookup(t => t.NodeId, t => t.Tag);
        return nodes.Select(n => new NodeSummary(n.Id, Enum.Parse<NodeType>(n.Type), n.Name, n.ParentId, n.Branch, n.SubType,
            n.Connector, n.Operation, lookup[n.Id].Order().ToList())).ToList();
    }

    private static string EscapeLike(string value) => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    public static GraphNode ToModel(NodeEntity n) =>
        new(n.Id, Enum.Parse<NodeType>(n.Type), n.Name, n.ParentId, n.Branch, n.SubType, n.RawJson, n.Properties, n.Order);

    private static GraphEdge ToModel(EdgeEntity e) =>
        new(e.SourceId, e.TargetId, Enum.Parse<EdgeType>(e.Type), (RunStatus)e.Status, e.Expression);

    private static UnresolvedReference ToModel(UnresolvedEntity u) => new(u.NodeId, u.RawExpression, u.Reason);

    private static ImportSummary ToSummary(ImportEntity i) =>
        new(i.Id, i.Kind, i.Name, i.Version, i.FileName, i.ImportedAt, i.NodeCount, i.EdgeCount, i.UnresolvedCount, i.Warnings);

    private sealed record ImpactRow(string Id, int Depth, string Via);
}
