namespace PPSolutionExplorer.Core.Quality;

/// <summary>Per-rule override. Omitted values keep the rule default.</summary>
public sealed class RuleSetting
{
    public bool Enabled { get; set; } = true;

    public Severity? Severity { get; set; }
}

/// <summary>A named rule set (per team or project). Bound from configuration <c>Quality:Profiles:&lt;name&gt;</c>.</summary>
public sealed class QualityProfile
{
    public Dictionary<string, RuleSetting> Rules { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>PPSE003 threshold: container levels below the flow root.</summary>
    public int MaxNestingDepth { get; set; } = 6;

    /// <summary>PPSE014 threshold: steps per flow.</summary>
    public int MaxActions { get; set; } = 250;

    public static readonly IReadOnlyList<string> DefaultSecretKeys =
        ["password", "secret", "apikey", "api_key", "api-key", "client_secret", "clientsecret", "token", "authorization", "sharedaccesskey", "accountkey"];

    /// <summary>PPSE012: input keys whose literal values are treated as secrets (case-insensitive, substring). Null: defaults.</summary>
    /// <remarks>Nullable on purpose: the configuration binder appends to existing lists instead of replacing them.</remarks>
    public List<string>? SecretKeys { get; set; }

    public IReadOnlyList<string> EffectiveSecretKeys => SecretKeys ?? DefaultSecretKeys;

    public static QualityProfile Default => new();

    public bool IsEnabled(string ruleId) => !Rules.TryGetValue(ruleId, out var setting) || setting.Enabled;

    public Severity SeverityOf(RuleDefinition rule) =>
        Rules.TryGetValue(rule.Id, out var setting) && setting.Severity is { } severity ? severity : rule.DefaultSeverity;
}

public sealed class QualityOptions
{
    public const string Section = "Quality";

    public string DefaultProfile { get; set; } = "default";

    public Dictionary<string, QualityProfile> Profiles { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public QualityProfile Resolve(string? name)
    {
        var key = string.IsNullOrWhiteSpace(name) ? DefaultProfile : name;
        if (Profiles.TryGetValue(key, out var profile))
        {
            return profile;
        }

        if (string.IsNullOrWhiteSpace(name) || string.Equals(name, "default", StringComparison.OrdinalIgnoreCase))
        {
            return QualityProfile.Default;
        }

        throw new ArgumentException($"Quality profile '{name}' is not configured.");
    }
}
