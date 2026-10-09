using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace PPSolutionExplorer.Ai.Llm;

/// <summary>
/// Client for llama.cpp <c>llama-server</c> (OpenAI-compatible API). The only outbound call the app makes,
/// and only to a loopback address.
/// </summary>
public sealed class LlamaCppClient : ILlmClient
{
    private readonly HttpClient _http;
    private readonly AiOptions _options;
    private string? _serverModel;

    public LlamaCppClient(HttpClient http, IOptions<AiOptions> options)
    {
        _options = options.Value;
        EnsureLoopback(_options.BaseUrl);
        _http = http;
        _http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(Math.Max(5, _options.TimeoutSeconds));
    }

    /// <summary>Local-only rule: refuse any non-loopback host.</summary>
    public static void EnsureLoopback(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            throw new InvalidOperationException($"Ai:BaseUrl '{baseUrl}' is not a valid http(s) URL.");
        }

        if (!uri.IsLoopback)
        {
            throw new InvalidOperationException($"Ai:BaseUrl '{baseUrl}' is not a loopback address. Customer data must not leave the machine.");
        }
    }

    public async Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct)
    {
        var body = await BuildBodyAsync(request, stream: false, ct);
        using var response = await SendAsync(body, HttpCompletionOption.ResponseContentRead, ct);
        var json = await response.Content.ReadFromJsonAsync<JsonObject>(ct) ?? throw new LlmException("Empty response from llama-server.");
        var choice = json["choices"]?[0];
        var content = choice?["message"]?["content"]?.GetValue<string>() ?? throw new LlmException("Response has no message content.");
        return new LlmResponse(content, json["model"]?.GetValue<string>() ?? await ModelNameAsync(ct), choice?["finish_reason"]?.GetValue<string>());
    }

    public async IAsyncEnumerable<string> StreamAsync(LlmRequest request, [EnumeratorCancellation] CancellationToken ct)
    {
        var body = await BuildBodyAsync(request, stream: true, ct);
        using var response = await SendAsync(body, HttpCompletionOption.ResponseHeadersRead, ct);
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream, Encoding.UTF8);

        while (await reader.ReadLineAsync(ct) is { } line)
        {
            if (!line.StartsWith("data:", StringComparison.Ordinal))
            {
                continue;
            }

            var data = line[5..].Trim();
            if (data == "[DONE]")
            {
                yield break;
            }

            var chunk = JsonNode.Parse(data);
            var delta = chunk?["choices"]?[0]?["delta"]?["content"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(delta))
            {
                yield return delta;
            }
        }
    }

    public async Task<int> CountTokensAsync(string text, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("tokenize", new { content = text }, ct);
        await EnsureSuccess(response, ct);
        var json = await response.Content.ReadFromJsonAsync<JsonObject>(ct);
        return json?["tokens"]?.AsArray().Count ?? throw new LlmException("/tokenize returned no tokens array.");
    }

    public async Task<string> ModelNameAsync(CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(_options.Model))
        {
            return _options.Model;
        }

        if (_serverModel is not null)
        {
            return _serverModel;
        }

        var json = await _http.GetFromJsonAsync<JsonObject>("v1/models", ct);
        _serverModel = json?["data"]?[0]?["id"]?.GetValue<string>() ?? "unknown-model";
        return _serverModel;
    }

    public async Task<LlmHealth> HealthAsync(CancellationToken ct)
    {
        try
        {
            using var response = await _http.GetAsync("health", ct);
            if (!response.IsSuccessStatusCode)
            {
                return new LlmHealth(false, null, $"/health returned {(int)response.StatusCode}.");
            }

            return new LlmHealth(true, await ModelNameAsync(ct), null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new LlmHealth(false, null, ex.Message);
        }
    }

    private async Task<JsonObject> BuildBodyAsync(LlmRequest request, bool stream, CancellationToken ct)
    {
        var messages = new JsonArray();
        foreach (var message in request.Messages)
        {
            messages.Add(new JsonObject { ["role"] = message.Role, ["content"] = message.Content });
        }

        var body = new JsonObject
        {
            ["model"] = await ModelNameAsync(ct),
            ["messages"] = messages,
            ["temperature"] = request.Temperature,
            ["max_tokens"] = request.MaxTokens,
            ["stream"] = stream,
        };

        if (request.JsonSchema is not null)
        {
            body["response_format"] = new JsonObject
            {
                ["type"] = "json_schema",
                ["json_schema"] = new JsonObject
                {
                    ["name"] = request.SchemaName,
                    ["schema"] = request.JsonSchema.DeepClone(),
                },
            };
        }

        return body;
    }

    private async Task<HttpResponseMessage> SendAsync(JsonObject body, HttpCompletionOption option, CancellationToken ct)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };

        try
        {
            var response = await _http.SendAsync(message, option, ct);
            await EnsureSuccess(response, ct);
            return response;
        }
        catch (HttpRequestException ex)
        {
            throw new LlmException($"llama-server request failed: {ex.Message}", ex);
        }
    }

    private static async Task EnsureSuccess(HttpResponseMessage response, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            response.Dispose();
            throw new LlmException($"llama-server returned {(int)response.StatusCode}: {text[..Math.Min(text.Length, 500)]}");
        }
    }
}
