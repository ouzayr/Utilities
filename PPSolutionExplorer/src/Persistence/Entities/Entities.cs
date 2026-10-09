namespace PPSolutionExplorer.Persistence.Entities;

public sealed class ImportEntity
{
    public Guid Id { get; set; }
    public required string Kind { get; set; }
    public required string Name { get; set; }
    public string? Version { get; set; }
    public required string FileName { get; set; }
    public required string Sha256 { get; set; }
    public DateTimeOffset ImportedAt { get; set; }
    public List<string> Warnings { get; set; } = [];
    public int NodeCount { get; set; }
    public int EdgeCount { get; set; }
    public int UnresolvedCount { get; set; }
}

public sealed class NodeEntity
{
    public Guid ImportId { get; set; }
    public required string Id { get; set; }
    public required string Type { get; set; }
    public required string Name { get; set; }
    public string? ParentId { get; set; }
    public string? Branch { get; set; }
    public string? SubType { get; set; }

    /// <summary>Denormalised from properties for search facets.</summary>
    public string? Connector { get; set; }

    /// <summary>Denormalised from properties for search facets.</summary>
    public string? Operation { get; set; }

    /// <summary>Raw source text, stored verbatim (text, not jsonb, so nothing is normalised away).</summary>
    public string? RawJson { get; set; }

    public Dictionary<string, string> Properties { get; set; } = [];
    public int Order { get; set; }
}

public sealed class EdgeEntity
{
    public long Id { get; set; }
    public Guid ImportId { get; set; }
    public required string SourceId { get; set; }
    public required string TargetId { get; set; }
    public required string Type { get; set; }
    public int Status { get; set; }
    public string? Expression { get; set; }
}

public sealed class UnresolvedEntity
{
    public long Id { get; set; }
    public Guid ImportId { get; set; }
    public required string NodeId { get; set; }
    public required string RawExpression { get; set; }
    public required string Reason { get; set; }
}

/// <summary>Sidecar tag, keyed by node ID (not import) so it survives re-imports. Never written into solution files.</summary>
public sealed class TagEntity
{
    public long Id { get; set; }
    public required string NodeId { get; set; }
    public required string Tag { get; set; }

    /// <summary><c>user</c>, or <c>ai-accepted</c> when a user accepted an AI suggestion.</summary>
    public required string Source { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Sidecar note, keyed by node ID.</summary>
public sealed class NoteEntity
{
    public long Id { get; set; }
    public required string NodeId { get; set; }
    public required string Text { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>AI-generated content. Always carries model, prompt name/version and timestamp.</summary>
public sealed class AiOutputEntity
{
    public Guid Id { get; set; }
    public Guid? ImportId { get; set; }
    public required string NodeId { get; set; }
    public required string Kind { get; set; }
    public string? Content { get; set; }
    public required string Model { get; set; }
    public required string PromptName { get; set; }
    public required string PromptVersion { get; set; }
    public required string CacheKey { get; set; }

    /// <summary><c>succeeded</c> or <c>failed</c>.</summary>
    public required string AiStatus { get; set; }

    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class AiJobEntity
{
    public Guid Id { get; set; }
    public required string Kind { get; set; }
    public Guid? ImportId { get; set; }
    public required string NodeId { get; set; }

    /// <summary><c>queued</c>, <c>running</c>, <c>succeeded</c>, <c>failed</c>.</summary>
    public required string Status { get; set; }

    public int Progress { get; set; }
    public int Total { get; set; }
    public string? Error { get; set; }
    public Guid? OutputId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
