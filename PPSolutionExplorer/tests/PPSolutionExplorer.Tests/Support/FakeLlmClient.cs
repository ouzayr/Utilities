using System.Runtime.CompilerServices;
using PPSolutionExplorer.Ai.Llm;
using PPSolutionExplorer.Ai.Services;

namespace PPSolutionExplorer.Tests.Support;

/// <summary>Deterministic stand-in for llama-server. Tests never need a real model.</summary>
public sealed class FakeLlmClient(Func<LlmRequest, string> respond) : ILlmClient
{
    public List<LlmRequest> Requests { get; } = [];

    /// <summary>Whitespace-separated word count. Close enough to a tokenizer for chunking tests.</summary>
    public Task<int> CountTokensAsync(string text, CancellationToken ct) =>
        Task.FromResult(text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length);

    public Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct)
    {
        Requests.Add(request);
        return Task.FromResult(new LlmResponse(respond(request), "fake-model", "stop"));
    }

    public async IAsyncEnumerable<string> StreamAsync(LlmRequest request, [EnumeratorCancellation] CancellationToken ct)
    {
        Requests.Add(request);
        foreach (var word in respond(request).Split(' '))
        {
            await Task.Yield();
            yield return word + " ";
        }
    }

    public Task<string> ModelNameAsync(CancellationToken ct) => Task.FromResult("fake-model");

    public Task<LlmHealth> HealthAsync(CancellationToken ct) => Task.FromResult(new LlmHealth(true, "fake-model", null));
}

public sealed class InMemoryAiStore : IAiOutputStore
{
    public List<AiOutputRecord> Records { get; } = [];

    public Task<AiOutputRecord?> FindSucceededByCacheKeyAsync(string cacheKey, CancellationToken ct) =>
        Task.FromResult(Records.LastOrDefault(r => r.CacheKey == cacheKey && r.IsSuccess));

    public Task<AiOutputRecord> SaveAsync(AiOutputRecord record, CancellationToken ct)
    {
        Records.Add(record);
        return Task.FromResult(record);
    }
}
