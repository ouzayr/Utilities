namespace PPSolutionExplorer.Ai.Services;

/// <summary>AI-generated content with its provenance. Nothing AI-generated is stored without this metadata.</summary>
public sealed record AiOutputRecord(
    Guid Id,
    Guid? ImportId,
    string NodeId,
    string Kind,
    string? Content,
    string Model,
    string PromptName,
    string PromptVersion,
    string CacheKey,
    string AiStatus,
    string? Error,
    DateTimeOffset CreatedAt)
{
    public const string Succeeded = "succeeded";
    public const string Failed = "failed";

    public bool IsSuccess => AiStatus == Succeeded;
}

public interface IAiOutputStore
{
    Task<AiOutputRecord?> FindSucceededByCacheKeyAsync(string cacheKey, CancellationToken ct);

    Task<AiOutputRecord> SaveAsync(AiOutputRecord record, CancellationToken ct);
}

public static class AiKinds
{
    public const string FlowSummary = "flow-summary";
    public const string ScopeSummary = "scope-summary";
    public const string ActionDescription = "action-description";
    public const string TagSuggestions = "tag-suggestions";
    public const string NlSearch = "nl-search";
    public const string QualityExplanation = "quality-explanation";
}
