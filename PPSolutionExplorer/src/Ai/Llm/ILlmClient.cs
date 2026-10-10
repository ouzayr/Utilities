using System.Text.Json.Nodes;

namespace PPSolutionExplorer.Ai.Llm;

public sealed record LlmMessage(string Role, string Content)
{
    public static LlmMessage System(string content) => new("system", content);

    public static LlmMessage User(string content) => new("user", content);
}

/// <param name="JsonSchema">When set, output is constrained to this schema (llama.cpp compiles it to a grammar).</param>
public sealed record LlmRequest(
    IReadOnlyList<LlmMessage> Messages,
    double Temperature,
    int MaxTokens,
    JsonObject? JsonSchema = null,
    string SchemaName = "output");

public sealed record LlmResponse(string Content, string Model, string? FinishReason);

public sealed record LlmHealth(bool Reachable, string? Model, string? Error);

/// <summary>
/// Provider abstraction. Everything in the app depends on this, never on llama.cpp directly,
/// so the provider can be swapped by registering another implementation.
/// </summary>
public interface ILlmClient
{
    Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct);

    IAsyncEnumerable<string> StreamAsync(LlmRequest request, CancellationToken ct);

    Task<int> CountTokensAsync(string text, CancellationToken ct);

    /// <summary>The model name recorded on outputs.</summary>
    Task<string> ModelNameAsync(CancellationToken ct);

    Task<LlmHealth> HealthAsync(CancellationToken ct);
}

public sealed class LlmException(string message, Exception? inner = null) : Exception(message, inner);

public sealed class AiDisabledException() : Exception("AI is disabled (Ai:Enabled=false).");
