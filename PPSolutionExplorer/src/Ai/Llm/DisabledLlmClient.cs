namespace PPSolutionExplorer.Ai.Llm;

/// <summary>Registered when <c>Ai:Enabled=false</c>. Makes no network calls.</summary>
public sealed class DisabledLlmClient : ILlmClient
{
    public Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct) => throw new AiDisabledException();

    public IAsyncEnumerable<string> StreamAsync(LlmRequest request, CancellationToken ct) => throw new AiDisabledException();

    public Task<int> CountTokensAsync(string text, CancellationToken ct) => throw new AiDisabledException();

    public Task<string> ModelNameAsync(CancellationToken ct) => throw new AiDisabledException();

    public Task<LlmHealth> HealthAsync(CancellationToken ct) => Task.FromResult(new LlmHealth(false, null, "AI is disabled."));
}
