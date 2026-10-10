using System.Text.RegularExpressions;

namespace PPSolutionExplorer.Ai.Redaction;

/// <summary>
/// Removes sensitive values before anything is put in a prompt. Replacements are stable within one redactor
/// instance (the same GUID always becomes the same placeholder), so the model can still follow references.
/// </summary>
public sealed partial class Redactor
{
    private readonly RedactionOptions _options;
    private readonly List<(string Value, string Placeholder)> _knownValues;
    private readonly List<Regex> _extra;
    private readonly Dictionary<string, string> _guidMap = new(StringComparer.OrdinalIgnoreCase);

    /// <param name="environmentValues">(schema name, value) pairs to mask. Values shorter than 4 characters are ignored.</param>
    public Redactor(RedactionOptions options, IEnumerable<(string SchemaName, string Value)>? environmentValues = null)
    {
        _options = options;
        _knownValues = (environmentValues ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e.Value) && e.Value.Length >= 4)
            .DistinctBy(e => e.Value)
            .OrderByDescending(e => e.Value.Length)
            .Select(e => (e.Value, $"[ENV:{e.SchemaName}]"))
            .ToList();
        _extra = options.ExtraPatterns.Select(p => new Regex(p, RegexOptions.Compiled, TimeSpan.FromSeconds(1))).ToList();
    }

    public string Redact(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        if (_options.EnvironmentVariableValues)
        {
            foreach (var (value, placeholder) in _knownValues)
            {
                text = text.Replace(value, placeholder, StringComparison.Ordinal);
            }
        }

        if (_options.Secrets)
        {
            text = Jwt().Replace(text, "[TOKEN]");
            text = Bearer().Replace(text, "Bearer [TOKEN]");
            text = SecretAssignment().Replace(text, m => $"{m.Groups["key"].Value}{m.Groups["sep"].Value}[SECRET]");
            text = SasSignature().Replace(text, "${prefix}[SECRET]");
        }

        if (_options.TenantUrls)
        {
            text = DataverseUrl().Replace(text, "https://[DATAVERSE-ORG]${suffix}");
            text = SharePointUrl().Replace(text, "https://[TENANT]${suffix}");
            text = TenantDomain().Replace(text, "[TENANT].onmicrosoft.com");
        }

        if (_options.Emails)
        {
            text = Email().Replace(text, "[EMAIL]");
        }

        if (_options.Guids)
        {
            text = Guid().Replace(text, m =>
            {
                if (!_guidMap.TryGetValue(m.Value, out var placeholder))
                {
                    placeholder = $"[ID-{_guidMap.Count + 1}]";
                    _guidMap[m.Value] = placeholder;
                }

                return placeholder;
            });
        }

        foreach (var pattern in _extra)
        {
            text = pattern.Replace(text, "[REDACTED]");
        }

        return text;
    }

    [GeneratedRegex(@"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*")]
    private static partial Regex Jwt();

    [GeneratedRegex(@"(?i)Bearer\s+[A-Za-z0-9._~+/=-]{8,}")]
    private static partial Regex Bearer();

    [GeneratedRegex(@"(?i)(?<key>password|pwd|accountkey|sharedaccesskey|client_?secret|secret|api_?key|access_?token|refresh_?token|sig)(?<sep>[""']?\s*[=:]\s*[""']?)[^;""'\s&,}]+")]
    private static partial Regex SecretAssignment();

    [GeneratedRegex(@"(?i)(?<prefix>[?&]sig=)[^&""'\s]+")]
    private static partial Regex SasSignature();

    [GeneratedRegex(@"(?i)https://[a-z0-9-]+(?<suffix>\.crm\d*\.dynamics\.com)")]
    private static partial Regex DataverseUrl();

    [GeneratedRegex(@"(?i)https://[a-z0-9-]+(?<suffix>(-my|-admin)?\.sharepoint\.com)")]
    private static partial Regex SharePointUrl();

    [GeneratedRegex(@"(?i)\b[a-z0-9-]+\.onmicrosoft\.com\b")]
    private static partial Regex TenantDomain();

    [GeneratedRegex(@"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")]
    private static partial Regex Email();

    [GeneratedRegex(@"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")]
    private static partial Regex Guid();
}
