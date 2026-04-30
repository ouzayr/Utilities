using System.ComponentModel.DataAnnotations.Schema;

namespace CodeCartographer.Api.Db;

[Table("repos")]
public sealed class Repo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Side { get; set; } = "ui"; // ui | api | both
    public string SourceKind { get; set; } = "local"; // local | github | azuredevops
    public string Location { get; set; } = "";
    public byte[]? PatEncrypted { get; set; }
    public string? IncludeGlobs { get; set; }
    public string? ExcludeGlobs { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("scans")]
public sealed class Scan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    public string Status { get; set; } = "running";
    public Guid[] RepoIds { get; set; } = Array.Empty<Guid>();
    public string Summary { get; set; } = "{}";
    public string? Error { get; set; }
    public string? Label { get; set; }
}

[Table("nodes")]
public sealed class Node
{
    public Guid ScanId { get; set; }
    public string NodeId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Side { get; set; } = "";
    public string Project { get; set; } = "";
    public string Name { get; set; } = "";
    public string FqName { get; set; } = "";
    public string FilePath { get; set; } = "";
    public int? Line { get; set; }
    public string Meta { get; set; } = "{}";
    public string Metrics { get; set; } = "{}";
}

[Table("edges")]
public sealed class Edge
{
    public Guid ScanId { get; set; }
    public string EdgeId { get; set; } = "";
    public string SourceId { get; set; } = "";
    public string TargetId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Meta { get; set; } = "{}";
}

[Table("findings")]
public sealed class Finding
{
    public Guid ScanId { get; set; }
    public string FindingId { get; set; } = "";
    public string RuleId { get; set; } = "";
    public string Severity { get; set; } = "info";
    public string Category { get; set; } = "architecture";
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string? NodeId { get; set; }
    public string? FilePath { get; set; }
    public int? Line { get; set; }
}

[Table("coverage")]
public sealed class Coverage
{
    public Guid ScanId { get; set; }
    public string FilePath { get; set; } = "";
    public int Line { get; set; }
    public int Hits { get; set; }
}

[Table("bookmarks")]
public sealed class Bookmark
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Config { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
