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
    private readonly Dictionary<(string, string, EdgeType), int> _edgeIndex = [];

    // Adjacency indexes keep lookups O(degree) so flows with thousands of steps stay fast.
    private readonly Dictionary<string, List<int>> _outgoing = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<int>> _incoming = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<string>> _children = new(StringComparer.Ordinal);
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

        SetNode(node);
        return node;
    }

    public void AddOrReplace(GraphNode node) => SetNode(node);

    private void SetNode(GraphNode node)
    {
        if (_nodes.TryGetValue(node.Id, out var previous) && previous.ParentId is { } oldParent && _children.TryGetValue(oldParent, out var siblings))
        {
            siblings.Remove(node.Id);
        }

        _nodes[node.Id] = node;
        if (node.ParentId is { } parent)
        {
            if (!_children.TryGetValue(parent, out var list))
            {
                _children[parent] = list = [];
            }

            list.Add(node.Id);
        }
    }

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
        var key = (edge.SourceId, edge.TargetId, edge.Type);
        if (!_edgeIndex.TryGetValue(key, out var index))
        {
            index = _edges.Count;
            _edgeIndex[key] = index;
            _edges.Add(edge);
            Index(_outgoing, edge.SourceId, index);
            Index(_incoming, edge.TargetId, index);
            return;
        }

        var current = _edges[index];
        _edges[index] = current with { Status = current.Status | edge.Status, Expression = current.Expression ?? edge.Expression };
    }

    public void AddUnresolved(UnresolvedReference reference) => _unresolved.Add(reference);

    public void AddWarning(string warning) => _warnings.Add(warning);

    public IEnumerable<GraphEdge> Outgoing(string id, EdgeType? type = null) =>
        _outgoing.TryGetValue(id, out var list) ? list.Select(i => _edges[i]).Where(e => type is null || e.Type == type) : [];

    public IEnumerable<GraphEdge> Incoming(string id, EdgeType? type = null) =>
        _incoming.TryGetValue(id, out var list) ? list.Select(i => _edges[i]).Where(e => type is null || e.Type == type) : [];

    /// <summary>Direct children by <see cref="GraphNode.ParentId"/>, ordered by source order.</summary>
    public IEnumerable<GraphNode> Children(string parentId, string? branch = null) =>
        _children.TryGetValue(parentId, out var ids)
            ? ids.Select(id => _nodes[id])
                .Where(n => branch is null || n.Branch == branch)
                .OrderBy(n => n.Order)
                .ThenBy(n => n.Id, StringComparer.Ordinal)
            : [];

    private static void Index(Dictionary<string, List<int>> index, string key, int edge)
    {
        if (!index.TryGetValue(key, out var list))
        {
            index[key] = list = [];
        }

        list.Add(edge);
    }

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
