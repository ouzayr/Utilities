using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai;
using PPSolutionExplorer.Ai.Llm;

namespace PPSolutionExplorer.Tests.Ai;

/// <summary>
/// Needs a running llama-server. Excluded from the default run: <c>dotnet test --filter "Category!=LlamaLive"</c>.
/// Set PPSE_LLAMA_URL (default http://127.0.0.1:8080) and run <c>dotnet test --filter "Category=LlamaLive"</c>.
/// </summary>
[Trait("Category", "LlamaLive")]
public class LlamaLiveTests
{
    private static LlamaCppClient Client() => new(new HttpClient(new HttpClientHandler { UseProxy = false }), Options.Create(new AiOptions
    {
        Enabled = true,
        BaseUrl = Environment.GetEnvironmentVariable("PPSE_LLAMA_URL") ?? "http://127.0.0.1:8080",
        TimeoutSeconds = 120,
    }));

    [Fact]
    public async Task Server_is_healthy_and_tokenizes()
    {
        var client = Client();
        var health = await client.HealthAsync(CancellationToken.None);
        Assert.True(health.Reachable, health.Error);
        Assert.True(await client.CountTokensAsync("Hello world", CancellationToken.None) > 0);
    }

    [Fact]
    public async Task Structured_output_follows_schema()
    {
        var schema = (System.Text.Json.Nodes.JsonObject)System.Text.Json.Nodes.JsonNode.Parse(
            """{ "type": "object", "required": ["summary"], "properties": { "summary": { "type": "string" } }, "additionalProperties": false }""")!;
        var response = await Client().CompleteAsync(new LlmRequest(
            [LlmMessage.System("Reply in JSON."), LlmMessage.User("Summarise: a flow that emails a manager.")], 0, 128, schema), CancellationToken.None);
        Assert.Empty(PPSolutionExplorer.Ai.Validation.SchemaValidator.Validate(System.Text.Json.Nodes.JsonNode.Parse(response.Content), schema));
    }
}
