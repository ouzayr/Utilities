using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Parsers.Flows;

internal static class ActionTypes
{
    private static readonly HashSet<string> KnownActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "OpenApiConnection", "OpenApiConnectionWebhook", "OpenApiConnectionNotification",
        "ApiConnection", "ApiConnectionWebhook", "ApiConnectionNotification", "ApiManagement",
        "Http", "HttpWebhook", "Response", "Compose", "Query", "Select", "Table", "Join", "ParseJson",
        "InitializeVariable", "SetVariable", "IncrementVariable", "DecrementVariable",
        "AppendToArrayVariable", "AppendToStringVariable", "Terminate", "Wait", "Workflow",
        "Expression", "JavaScriptCode", "Function", "Batch", "FlatFileDecoding", "FlatFileEncoding",
        "XmlValidation", "Xslt", "Liquid", "IntegrationAccountArtifactLookup", "ServiceProvider",
    };

    public static NodeType Classify(string? type) => type?.ToLowerInvariant() switch
    {
        "scope" => NodeType.Scope,
        "if" => NodeType.Condition,
        "foreach" or "until" => NodeType.Loop,
        "switch" => NodeType.Switch,
        null => NodeType.Unknown,
        _ when KnownActions.Contains(type) => NodeType.Action,
        _ => NodeType.Unknown,
    };
}
