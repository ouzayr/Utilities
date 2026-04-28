using System.Text.Json.Serialization;

namespace CodeCartographer.Api.Db;

public sealed class GraphPayload
{
    [JsonPropertyName("schemaVersion")] public int SchemaVersion { get; set; } = 1;
    [JsonPropertyName("side")] public string Side { get; set; } = "";
    [JsonPropertyName("project")] public string Project { get; set; } = "";
    [JsonPropertyName("scannedAt")] public string ScannedAt { get; set; } = "";
    [JsonPropertyName("nodes")] public List<NodeDto> Nodes { get; set; } = new();
    [JsonPropertyName("edges")] public List<EdgeDto> Edges { get; set; } = new();
    [JsonPropertyName("findings")] public List<FindingDto> Findings { get; set; } = new();
    [JsonPropertyName("metrics")] public Dictionary<string, double> Metrics { get; set; } = new();
}

public sealed class NodeDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("kind")] public string Kind { get; set; } = "";
    [JsonPropertyName("side")] public string Side { get; set; } = "";
    [JsonPropertyName("project")] public string Project { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("fqName")] public string FqName { get; set; } = "";
    [JsonPropertyName("filePath")] public string FilePath { get; set; } = "";
    [JsonPropertyName("line")] public int? Line { get; set; }
    [JsonPropertyName("meta")] public Dictionary<string, object?> Meta { get; set; } = new();
    [JsonPropertyName("metrics")] public Dictionary<string, double>? Metrics { get; set; }
}

public sealed class EdgeDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("source")] public string Source { get; set; } = "";
    [JsonPropertyName("target")] public string Target { get; set; } = "";
    [JsonPropertyName("kind")] public string Kind { get; set; } = "";
    [JsonPropertyName("meta")] public Dictionary<string, object?> Meta { get; set; } = new();
}

public sealed class FindingDto
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

public sealed class GraphSnapshot
{
    public Guid ScanId { get; set; }
    public string Status { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public string? Label { get; set; }
    public List<NodeDto> Nodes { get; set; } = new();
    public List<EdgeDto> Edges { get; set; } = new();
    public List<FindingDto> Findings { get; set; } = new();
    public Dictionary<string, double> Metrics { get; set; } = new();
}

public sealed class IngestResponse
{
    public Guid ScanId { get; set; }
    public int NodesIngested { get; set; }
    public int EdgesIngested { get; set; }
    public int FindingsIngested { get; set; }
    public int CrossLinks { get; set; }
}
