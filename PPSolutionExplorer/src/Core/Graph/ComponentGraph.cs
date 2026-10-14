using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Graph;

/// <summary>
/// In-memory component graph. Built by the parsers, persisted by the store, and loaded back
/// (per flow or per import) for path tracing and quality rules.
/// </summary>
public sealed class ComponentGraph
{
    private readonly Dictionary<string, GraphNode> _nodes = new(StringComparer.Ordinal);
    private readonly List<GraphEdge> _edges = [];
    private readonly HashSet<(string, string, EdgeType)> _edgeKeys = [];
    private readonly List<UnresolvedReference> _unresolved = [];
    private readonly List<string> _warnings = [];

    public IReadOnlyCollection<GraphNode> Nodes => _nodes.Values;

    public IReadOnlyList<GraphEdge> Edges => _edges;

    public IReadOnlyList<UnresolvedReference> Unresolved => _unresolved;

    public IReadOnlyList<string> Warnings => _warnings;

    public ComponentGraph()
    {
    }

    public ComponentGraph(IEnumerable<GraphNode> nodes, IEnumerable<GraphEdge> edges, IEnumerable<UnresolvedReference>? unresolved = null)
    {
        foreach (var node in nodes)
        {
            AddOrReplace(node);
        }

        foreach (var edge in edges)
        {
            AddEdge(edge);
        }

        if (unresolved is not null)
        {
            _unresolved.AddRange(unresolved);
        }
    }

    public GraphNode? Find(string id) => _nodes.GetValueOrDefault(id);

    public bool Contains(string id) => _nodes.ContainsKey(id);

    /// <summary>Adds the node. A real definition replaces a placeholder; otherwise the first wins.</summary>
    public GraphNode Add(GraphNode node)
    {
        if (_nodes.TryGetValue(node.Id, out var existing) && !(existing.IsPlaceholder && !node.IsPlaceholder))
        {
            return existing;
        }

        _nodes[node.Id] = node;
        return node;
    }

    public void AddOrReplace(GraphNode node) => _nodes[node.Id] = node;

    /// <summary>Adds a placeholder node for something referenced but not defined (yet).</summary>
    public GraphNode EnsurePlaceholder(string id, NodeType type, string name, IReadOnlyDictionary<string, string>? properties = null)
    {
        if (_nodes.TryGetValue(id, out var existing))
        {
            return existing;
        }

        var props = new Dictionary<string, string>(properties ?? new Dictionary<string, string>())
        {
            [NodeProperties.Placeholder] = "true",
        };
        return Add(new GraphNode(id, type, name, Properties: props));
    }

    /// <summary>Adds an edge. Duplicate (source, target, type) edges are merged (status flags OR'd).</summary>
    public void AddEdge(GraphEdge edge)
    {
        if (_edgeKeys.Add((edge.SourceId, edge.TargetId, edge.Type)))
        {
            _edges.Add(edge);
            return;
        }

        var index = _edges.FindIndex(e => e.SourceId == edge.SourceId && e.TargetId == edge.TargetId && e.Type == edge.Type);
        var current = _edges[index];
        _edges[index] = current with { Status = current.Status | edge.Status, Expression = current.Expression ?? edge.Expression };
    }

    public void AddUnresolved(UnresolvedReference reference) => _unresolved.Add(reference);

    public void AddWarning(string warning) => _warnings.Add(warning);

    public IEnumerable<GraphEdge> Outgoing(string id, EdgeType? type = null) =>
        _edges.Where(e => e.SourceId == id && (type is null || e.Type == type));

    public IEnumerable<GraphEdge> Incoming(string id, EdgeType? type = null) =>
        _edges.Where(e => e.TargetId == id && (type is null || e.Type == type));

    /// <summary>Direct children by <see cref="GraphNode.ParentId"/>, ordered by source order.</summary>
    public IEnumerable<GraphNode> Children(string parentId, string? branch = null) =>
        _nodes.Values
            .Where(n => n.ParentId == parentId && (branch is null || n.Branch == branch))
            .OrderBy(n => n.Order)
            .ThenBy(n => n.Id, StringComparer.Ordinal);

    /// <summary>All descendants (depth-first) by <see cref="GraphNode.ParentId"/>.</summary>
    public IEnumerable<GraphNode> Descendants(string parentId)
    {
        foreach (var child in Children(parentId))
        {
            yield return child;
            foreach (var grandChild in Descendants(child.Id))
            {
                yield return grandChild;
            }
        }
    }

    /// <summary>Returns the flow sub-graph (flow node, its steps, and every edge touching them).</summary>
    public ComponentGraph FlowSubgraph(string flowId)
    {
        var flow = Find(flowId) ?? throw new KeyNotFoundException($"Flow '{flowId}' not found.");
        var ids = new HashSet<string>(StringComparer.Ordinal) { flow.Id };
        foreach (var descendant in Descendants(flow.Id))
        {
            ids.Add(descendant.Id);
        }

        var edges = _edges.Where(e => ids.Contains(e.SourceId) || ids.Contains(e.TargetId)).ToList();
        foreach (var edge in edges)
        {
            ids.Add(edge.SourceId);
            ids.Add(edge.TargetId);
        }

        return new ComponentGraph(
            ids.Select(Find).OfType<GraphNode>(),
            edges,
            _unresolved.Where(u => ids.Contains(u.NodeId)));
    }

    /// <summary>Merges another graph into this one (used when a solution contains several flows).</summary>
    public void Merge(ComponentGraph other)
    {
        foreach (var node in other.Nodes)
        {
            Add(node);
        }

        foreach (var edge in other.Edges)
        {
            AddEdge(edge);
        }

        _unresolved.AddRange(other.Unresolved);
        _warnings.AddRange(other.Warnings);
    }
}
