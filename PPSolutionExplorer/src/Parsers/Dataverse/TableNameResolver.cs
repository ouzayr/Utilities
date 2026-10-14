namespace PPSolutionExplorer.Parsers.Dataverse;

/// <summary>
/// Maps Dataverse entity set names (used by actions, e.g. <c>accounts</c>) to logical names
/// (used by triggers and metadata, e.g. <c>account</c>). Only mappings found in solution metadata are used.
/// Unknown names are kept as-is; the resolver never pluralises or singularises.
/// </summary>
public sealed class TableNameResolver
{
    private readonly Dictionary<string, string> _entitySetToLogical = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _logical = new(StringComparer.OrdinalIgnoreCase);

    public static TableNameResolver Empty => new();

    public void Register(string logicalName, string? entitySetName)
    {
        _logical.Add(logicalName);
        if (!string.IsNullOrWhiteSpace(entitySetName))
        {
            _entitySetToLogical[entitySetName] = logicalName;
        }
    }

    /// <summary>Returns the logical name when known, otherwise the input unchanged.</summary>
    public string Resolve(string name, out bool known)
    {
        if (_logical.Contains(name))
        {
            known = true;
            return name.ToLowerInvariant();
        }

        if (_entitySetToLogical.TryGetValue(name, out var logical))
        {
            known = true;
            return logical.ToLowerInvariant();
        }

        known = false;
        return name;
    }
}
