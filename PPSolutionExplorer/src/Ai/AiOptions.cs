namespace PPSolutionExplorer.Ai;

/// <summary>Bound from the <c>Ai</c> configuration section. The model is configuration, never hard-coded.</summary>
public sealed class AiOptions
{
    public const string Section = "Ai";

    /// <summary>When false, every AI endpoint returns 503 and the rest of the app works unchanged.</summary>
    public bool Enabled { get; set; }

    /// <summary>llama.cpp <c>llama-server</c>. Must be a loopback address (local only).</summary>
    public string BaseUrl { get; set; } = "http://127.0.0.1:8080";

    /// <summary>Model name sent to the server and recorded on every AI output. Empty: ask the server (<c>/v1/models</c>).</summary>
    public string Model { get; set; } = "";

    /// <summary>Total server context (<c>-c</c>). Split across <see cref="ParallelSlots"/>.</summary>
    public int ContextSize { get; set; } = 32768;

    /// <summary>Server <c>--parallel</c>. Each slot gets ContextSize / ParallelSlots tokens.</summary>
    public int ParallelSlots { get; set; } = 2;

    public int TimeoutSeconds { get; set; } = 300;

    /// <summary>Default temperature. Structured output is clamped to 0-0.2.</summary>
    public double Temperature { get; set; } = 0.1;

    /// <summary>Tokens reserved for the answer in each call.</summary>
    public int MaxOutputTokens { get; set; } = 1024;

    /// <summary>Folder holding versioned prompt templates. Relative paths resolve from the app base directory.</summary>
    public string PromptsPath { get; set; } = "prompts";

    /// <summary>Fixed tag vocabulary offered to the tag-suggestion prompt.</summary>
    public List<string> TagVocabulary { get; set; } =
    [
        "integration", "notification", "approval", "data-sync", "reporting", "scheduled", "error-handling",
        "child-flow", "dataverse", "sharepoint", "email", "teams", "http", "file-handling", "security", "legacy",
    ];

    public RedactionOptions Redaction { get; set; } = new();

    public int SlotContext => Math.Max(1024, ContextSize / Math.Max(1, ParallelSlots));
}

/// <summary>What the redactor removes before anything is sent to the model. All on by default.</summary>
public sealed class RedactionOptions
{
    public bool EnvironmentVariableValues { get; set; } = true;
    public bool Secrets { get; set; } = true;
    public bool Emails { get; set; } = true;
    public bool Guids { get; set; } = true;
    public bool TenantUrls { get; set; } = true;

    /// <summary>Extra regular expressions; each match is replaced with <c>[REDACTED]</c>.</summary>
    public List<string> ExtraPatterns { get; set; } = [];
}
