namespace PPSolutionExplorer.Core.Model;

/// <summary>
/// Deterministic node IDs. Tags and notes are keyed by these, so they must stay stable across re-imports.
/// </summary>
public static class NodeIds
{
    public static string Solution(string uniqueName) => $"sol:{uniqueName.ToLowerInvariant()}";

    public static string Flow(string flowId) => $"flow:{NormaliseGuid(flowId)}";

    public static string Trigger(string flowNodeId, string name) => $"{flowNodeId}/trigger:{name}";

    public static string Action(string flowNodeId, string name) => $"{flowNodeId}/action:{name}";

    public static string Table(string name) => $"table:{name.ToLowerInvariant()}";

    public static string Column(string table, string column) => $"column:{table.ToLowerInvariant()}.{column.ToLowerInvariant()}";

    public static string EnvVariable(string schemaName) => $"env:{schemaName.ToLowerInvariant()}";

    public static string ConnectionReference(string logicalName) => $"connref:{logicalName.ToLowerInvariant()}";

    public static string Connector(string apiName) => $"connector:{apiName.ToLowerInvariant()}";

    public static string App(string name) => $"app:{name.ToLowerInvariant()}";

    public static string NormaliseGuid(string value)
    {
        var trimmed = value.Trim().Trim('{', '}');
        return Guid.TryParse(trimmed, out var guid) ? guid.ToString("D") : trimmed.ToLowerInvariant();
    }
}
