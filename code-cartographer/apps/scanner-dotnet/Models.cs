using System.Text.Json.Serialization;

namespace CodeCartographer.ScannerDotnet;

public sealed class ScanResult
{
    [JsonPropertyName("schemaVersion")] public int SchemaVersion { get; set; } = 1;
    [JsonPropertyName("side")] public string Side { get; set; } = "api";
    [JsonPropertyName("project")] public string Project { get; set; } = "";
    [JsonPropertyName("scannedAt")] public string ScannedAt { get; set; } = DateTime.UtcNow.ToString("o");
    [JsonPropertyName("nodes")] public List<GraphNode> Nodes { get; set; } = new();
    [JsonPropertyName("edges")] public List<GraphEdge> Edges { get; set; } = new();
    [JsonPropertyName("findings")] public List<Finding> Findings { get; set; } = new();
    [JsonPropertyName("metrics")] public Dictionary<string, double> Metrics { get; set; } = new();
}

public sealed class GraphNode
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("kind")] public string Kind { get; set; } = "";
    [JsonPropertyName("side")] public string Side { get; set; } = "api";
    [JsonPropertyName("project")] public string Project { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("fqName")] public string FqName { get; set; } = "";
    [JsonPropertyName("filePath")] public string FilePath { get; set; } = "";
    [JsonPropertyName("line")] public int? Line { get; set; }
    [JsonPropertyName("meta")] public Dictionary<string, object?> Meta { get; set; } = new();
    [JsonPropertyName("metrics")] public Dictionary<string, double>? Metrics { get; set; }
}

public sealed class GraphEdge
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("source")] public string Source { get; set; } = "";
    [JsonPropertyName("target")] public string Target { get; set; } = "";
    [JsonPropertyName("kind")] public string Kind { get; set; } = "";
    [JsonPropertyName("meta")] public Dictionary<string, object?> Meta { get; set; } = new();
}

public sealed class Finding
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("ruleId")] public string RuleId { get; set; } = "";
    [JsonPropertyName("severity")] public string Severity { get; set; } = "info";
    [JsonPropertyName("category")] public string Category { get; set; } = "architecture";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("detail")] public string Detail { get; set; } = "";
    [JsonPropertyName("nodeId")] public string? NodeId { get; set; }
    [JsonPropertyName("filePath")] public string? FilePath { get; set; }
    [JsonPropertyName("line")] public int? Line { get; set; }
}

public static class Ids
{
    public static string NodeId(string side, string kind, string fqName, string project) => $"{side}:{kind}:{fqName}@{project}";
    public static string EdgeId(string kind, string source, string target, string suffix = "") => string.IsNullOrEmpty(suffix) ? $"{kind}|{source}->{target}" : $"{kind}|{source}->{target}|{suffix}";
}
