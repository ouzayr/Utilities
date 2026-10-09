using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai.Llm;
using PPSolutionExplorer.Ai.Prompts;
using PPSolutionExplorer.Ai.Validation;

namespace PPSolutionExplorer.Ai.Services;

/// <summary>
/// Runs one prompt: cache lookup, call, schema validation, one retry, and storage with provenance.
/// On a second failure the output is stored with <c>ai_status = failed</c>; callers never block on it.
/// </summary>
public sealed class AiRunner(ILlmClient llm, IPromptLibrary prompts, IAiOutputStore store, IOptions<AiOptions> options, ILogger<AiRunner> logger)
{
    private const double MaxStructuredTemperature = 0.2;
    private readonly AiOptions _options = options.Value;

    public IPromptLibrary Prompts => prompts;

    public async Task<AiOutputRecord> RunStructuredAsync(string promptName, IReadOnlyDictionary<string, string> values,
        Guid? importId, string nodeId, string kind, CancellationToken ct, Func<JsonNode, JsonNode>? postProcess = null)
    {
        var prompt = prompts.Get(promptName);
        if (prompt.Schema is null)
        {
            throw new InvalidOperationException($"Prompt '{prompt.Id}' has no schema; use streaming instead.");
        }

        var user = prompt.Render(values);
        var model = await llm.ModelNameAsync(ct);
        var cacheKey = CacheKey(prompt.System + "\n" + user, prompt.Id, model);
        if (await store.FindSucceededByCacheKeyAsync(cacheKey, ct) is { } cached)
        {
            return cached;
        }

        var request = new LlmRequest(
            [LlmMessage.System(prompt.System), LlmMessage.User(user)],
            Math.Clamp(prompt.Temperature ?? _options.Temperature, 0, MaxStructuredTemperature),
            prompt.MaxOutputTokens ?? _options.MaxOutputTokens,
            prompt.Schema,
            prompt.Name.Replace('-', '_'));

        string? error = null;
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            try
            {
                var response = await llm.CompleteAsync(request, ct);
                if (SchemaValidator.TryParse(response.Content, prompt.Schema, out var node, out var errors))
                {
                    var content = (postProcess is null ? node! : postProcess(node!)).ToJsonString();
                    return await SaveAsync(importId, nodeId, kind, content, response.Model, prompt, cacheKey, AiOutputRecord.Succeeded, null, ct);
                }

                error = "Invalid structured output: " + string.Join("; ", errors.Take(5));
            }
            catch (Exception ex) when (ex is LlmException or HttpRequestException || (ex is TaskCanceledException && !ct.IsCancellationRequested))
            {
                error = ex is TaskCanceledException ? $"Timed out after {_options.TimeoutSeconds}s." : ex.Message;
            }

            logger.LogWarning("AI prompt {Prompt} attempt {Attempt} failed for {Node}: {Error}", prompt.Id, attempt, nodeId, error);
        }

        return await SaveAsync(importId, nodeId, kind, null, model, prompt, cacheKey, AiOutputRecord.Failed, error, ct);
    }

    /// <summary>Streams a free-text prompt and stores the full text (with provenance) when done.</summary>
    public async IAsyncEnumerable<string> StreamAsync(string promptName, IReadOnlyDictionary<string, string> values,
        Guid? importId, string nodeId, string kind, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        var prompt = prompts.Get(promptName);
        var user = prompt.Render(values);
        var model = await llm.ModelNameAsync(ct);
        var request = new LlmRequest(
            [LlmMessage.System(prompt.System), LlmMessage.User(user)],
            prompt.Temperature ?? _options.Temperature,
            prompt.MaxOutputTokens ?? _options.MaxOutputTokens);

        var text = new StringBuilder();
        await foreach (var token in llm.StreamAsync(request, ct))
        {
            text.Append(token);
            yield return token;
        }

        var content = new JsonObject { ["description"] = text.ToString().Trim() }.ToJsonString();
        await SaveAsync(importId, nodeId, kind, content, model, prompt, CacheKey(prompt.System + "\n" + user, prompt.Id, model), AiOutputRecord.Succeeded, null, ct);
    }

    /// <summary>Tokens available for flow content in one call of this prompt.</summary>
    public async Task<int> InputBudgetAsync(string promptName, CancellationToken ct)
    {
        var prompt = prompts.Get(promptName);
        var overhead = await llm.CountTokensAsync(prompt.System + prompt.User, ct);
        var output = prompt.MaxOutputTokens ?? _options.MaxOutputTokens;
        var safety = _options.SlotContext / 20;
        return Math.Max(256, _options.SlotContext - overhead - output - safety);
    }

    public static string CacheKey(string content, string promptId, string model)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{promptId}\n{model}\n{content}"));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private Task<AiOutputRecord> SaveAsync(Guid? importId, string nodeId, string kind, string? content, string model,
        PromptTemplate prompt, string cacheKey, string status, string? error, CancellationToken ct) =>
        store.SaveAsync(new AiOutputRecord(Guid.NewGuid(), importId, nodeId, kind, content, model, prompt.Name, prompt.Version,
            cacheKey, status, error, DateTimeOffset.UtcNow), ct);
}
