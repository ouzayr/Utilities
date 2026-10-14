namespace PPSolutionExplorer.Core.Model;

/// <param name="Id">Deterministic ID (see <see cref="NodeIds"/>). Stable across re-imports.</param>
/// <param name="ParentId">Containing node (Flow, Scope, Condition...). Null for top-level nodes.</param>
/// <param name="Branch">Branch inside the parent, e.g. <c>true</c>, <c>else</c>, <c>case:X</c>, <c>default</c>.</param>
/// <param name="SubType">Source-specific type, e.g. the flow action <c>type</c> or the Dataverse operation.</param>
/// <param name="RawJson">Raw source JSON (or XML) so nothing is lost.</param>
public sealed record GraphNode(
    string Id,
    NodeType Type,
    string Name,
    string? ParentId = null,
    string? Branch = null,
    string? SubType = null,
    string? RawJson = null,
    IReadOnlyDictionary<string, string>? Properties = null,
    int Order = 0)
{
    public string? Property(string key) =>
        Properties is not null && Properties.TryGetValue(key, out var value) ? value : null;

    public bool IsPlaceholder => Property(NodeProperties.Placeholder) == "true";
}

public static class NodeProperties
{
    /// <summary>Node referenced but not defined in the imported content (e.g. external child flow).</summary>
    public const string Placeholder = "placeholder";
    public const string ConnectorId = "connectorId";
    public const string OperationId = "operationId";
    public const string ConnectionName = "connectionName";
    public const string DisplayName = "displayName";
    public const string Description = "description";
    public const string DefaultValue = "defaultValue";
    public const string CurrentValue = "currentValue";
    public const string Version = "version";
    public const string Managed = "managed";
    public const string Category = "category";
    public const string TableName = "table";
    public const string ConcurrencyRepetitions = "concurrency";
    public const string State = "state";
}
