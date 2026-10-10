using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace PPSolutionExplorer.Ai.Prompts;

/// <summary>A versioned prompt loaded from <c>/prompts</c>. Any change to a prompt must bump <see cref="Version"/>.</summary>
public sealed class PromptTemplate
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("version")]
    public required string Version { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("temperature")]
    public double? Temperature { get; init; }

    [JsonPropertyName("maxOutputTokens")]
    public int? MaxOutputTokens { get; init; }

    [JsonPropertyName("system")]
    public required string System { get; init; }

    /// <summary>User message with <c>{{placeholder}}</c> slots.</summary>
    [JsonPropertyName("user")]
    public required string User { get; init; }

    /// <summary>JSON schema for structured output. Null for free-text (streamed) prompts.</summary>
    [JsonPropertyName("schema")]
    public JsonObject? Schema { get; init; }

    public string Id => $"{Name}@{Version}";

    public string Render(IReadOnlyDictionary<string, string> values)
    {
        var text = User;
        foreach (var (key, value) in values)
        {
            text = text.Replace("{{" + key + "}}", value, StringComparison.Ordinal);
        }

        return text;
    }
}
