using System.Text.Json;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Core.Diff;

/// <summary>
/// Compares two graphs by node ID. IDs are deterministic (flow GUID + action name), so the same flow exported
/// at two points in time, or from two environments, lines up without heuristics. A renamed action shows as
/// removed + added: matching by similarity would be a guess.
/// </summary>
public static class GraphDiffer
{
    /// <summary>Raw JSON paths that change on every designer save and carry no meaning.</summary>
    public static readonly IReadOnlyList<string> DefaultIgnoredPaths = ["metadata/operationMetadataId"];

    private static readonly HashSet<string> IgnoredProperties = new(StringComparer.Ordinal) { "file", "solutionMetadata", NodeProperties.ExpressionCount };

    private const int MaxValueLength = 500;

    public static GraphDiff Diff(ComponentGraph left, ComponentGraph right, string? flowId = null, IReadOnlyList<string>? ignoredPaths = null)
    {
        ignoredPaths ??= DefaultIgnoredPaths;
        bool InScope(string id) => flowId is null || id == flowId || id.StartsWith(flowId + "/", StringComparison.Ordinal);

        var leftNodes = left.Nodes.Where(n => InScope(n.Id) && !n.IsPlaceholder).ToDictionary(n => n.Id, StringComparer.Ordinal);
        var rightNodes = right.Nodes.Where(n => InScope(n.Id) && !n.IsPlaceholder).ToDictionary(n => n.Id, StringComparer.Ordinal);
        var nodes = new List<NodeChange>();

        foreach (var (id, node) in rightNodes.Where(kv => !leftNodes.ContainsKey(kv.Key)))
        {
            nodes.Add(new NodeChange(id, node.Type, node.Name, ChangeKind.Added, FlowOf(id), []));
        }

        foreach (var (id, node) in leftNodes.Where(kv => !rightNodes.ContainsKey(kv.Key)))
        {
            nodes.Add(new NodeChange(id, node.Type, node.Name, ChangeKind.Removed, FlowOf(id), []));
        }

        foreach (var (id, before) in leftNodes)
        {
            if (!rightNodes.TryGetValue(id, out var after))
            {
                continue;
            }

            var changes = new List<PropertyChange>();
            Compare("name", before.Name, after.Name, changes);
            Compare("type", before.SubType ?? before.Type.ToString(), after.SubType ?? after.Type.ToString(), changes);
            var moved = before.ParentId != after.ParentId || before.Branch != after.Branch;
            if (moved)
            {
                changes.Add(new PropertyChange("parent", Describe(left, before), Describe(right, after)));
            }

            CompareProperties(before, after, changes);
            CompareJson(before.RawJson, after.RawJson, ignoredPaths, changes);

            if (changes.Count > 0)
            {
                nodes.Add(new NodeChange(id, after.Type, after.Name, moved ? ChangeKind.Moved : ChangeKind.Changed, FlowOf(id), changes));
            }
        }

        var edges = DiffEdges(left, right, InScope);
        return new GraphDiff(
            nodes.OrderBy(n => n.FlowId, StringComparer.Ordinal).ThenBy(n => n.Kind).ThenBy(n => n.NodeId, StringComparer.Ordinal).ToList(),
            edges);
    }

    private static List<EdgeChange> DiffEdges(ComponentGraph left, ComponentGraph right, Func<string, bool> inScope)
    {
        static Dictionary<(string, string, EdgeType), GraphEdge> Index(ComponentGraph g, Func<string, bool> inScope) =>
            g.Edges.Where(e => e.Type != EdgeType.Contains && (inScope(e.SourceId) || inScope(e.TargetId)))
                .ToDictionary(e => (e.SourceId, e.TargetId, e.Type));

        var before = Index(left, inScope);
        var after = Index(right, inScope);
        var changes = new List<EdgeChange>();

        foreach (var (key, edge) in after.Where(kv => !before.ContainsKey(kv.Key)))
        {
            changes.Add(new EdgeChange(key.Item1, key.Item2, key.Item3, ChangeKind.Added, null, Label(edge)));
        }

        foreach (var (key, edge) in before)
        {
            if (!after.TryGetValue(key, out var other))
            {
                changes.Add(new EdgeChange(key.Item1, key.Item2, key.Item3, ChangeKind.Removed, Label(edge), null));
            }
            else if (edge.Status != other.Status)
            {
                changes.Add(new EdgeChange(key.Item1, key.Item2, key.Item3, ChangeKind.Changed, Label(edge), Label(other)));
            }
        }

        return changes.OrderBy(c => c.SourceId, StringComparer.Ordinal).ThenBy(c => c.TargetId, StringComparer.Ordinal).ToList();

        static string Label(GraphEdge e) => e.Type == EdgeType.RunsAfter ? e.Status.ToString() : e.Type.ToString();
    }

    private static void CompareProperties(GraphNode before, GraphNode after, List<PropertyChange> changes)
    {
        var keys = (before.Properties?.Keys ?? []).Union(after.Properties?.Keys ?? []).Where(k => !IgnoredProperties.Contains(k)).Order(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            Compare("property:" + key, before.Property(key), after.Property(key), changes);
        }
    }

    private static void CompareJson(string? before, string? after, IReadOnlyList<string> ignored, List<PropertyChange> changes)
    {
        if (before == after)
        {
            return;
        }

        JsonElement? left = Parse(before), right = Parse(after);
        if (left is null || right is null)
        {
            Compare("raw", before, after, changes);
            return;
        }

        Walk(left, right, "", ignored, changes);
    }

    private static void Walk(JsonElement? left, JsonElement? right, string path, IReadOnlyList<string> ignored, List<PropertyChange> changes)
    {
        if (ignored.Any(i => path.Equals(i, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        if (left is { ValueKind: JsonValueKind.Object } l && right is { ValueKind: JsonValueKind.Object } r)
        {
            var leftProps = l.EnumerateObject().ToDictionary(p => p.Name, p => p.Value, StringComparer.Ordinal);
            var rightProps = r.EnumerateObject().ToDictionary(p => p.Name, p => p.Value, StringComparer.Ordinal);
            foreach (var key in leftProps.Keys.Union(rightProps.Keys).Order(StringComparer.Ordinal))
            {
                Walk(leftProps.TryGetValue(key, out var lv) ? lv : null, rightProps.TryGetValue(key, out var rv) ? rv : null,
                    path.Length == 0 ? key : $"{path}/{key}", ignored, changes);
            }

            return;
        }

        if (left is { ValueKind: JsonValueKind.Array } la && right is { ValueKind: JsonValueKind.Array } ra && la.GetArrayLength() == ra.GetArrayLength())
        {
            var i = 0;
            foreach (var (a, b) in la.EnumerateArray().Zip(ra.EnumerateArray()))
            {
                Walk(a, b, $"{path}[{i++}]", ignored, changes);
            }

            return;
        }

        var before = left is null ? null : Text(left.Value);
        var after = right is null ? null : Text(right.Value);
        Compare(path.Length == 0 ? "raw" : path, before, after, changes);
    }

    private static string Text(JsonElement e) => e.ValueKind == JsonValueKind.String ? e.GetString()! : JsonSerializer.Serialize(e);

    private static void Compare(string path, string? before, string? after, List<PropertyChange> changes)
    {
        if (before != after)
        {
            changes.Add(new PropertyChange(path, Truncate(before), Truncate(after)));
        }
    }

    private static string? Truncate(string? value) => value is null || value.Length <= MaxValueLength ? value : value[..MaxValueLength] + "…";

    private static JsonElement? Parse(string? json)
    {
        if (json is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Describe(ComponentGraph graph, GraphNode node) =>
        (node.ParentId is null ? "(root)" : graph.Find(node.ParentId)?.Name ?? node.ParentId) + (node.Branch is null ? "" : $" [{node.Branch}]");

    private static string? FlowOf(string id)
    {
        if (!id.StartsWith("flow:", StringComparison.Ordinal))
        {
            return null;
        }

        var slash = id.IndexOf('/');
        return slash > 0 ? id[..slash] : id;
    }
}
