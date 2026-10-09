using PPSolutionExplorer.Core.Graph;

namespace PPSolutionExplorer.Parsers;

public enum ImportKind
{
    Solution,
    Package,
    Flow,
}

public sealed record ParseResult(ImportKind Kind, string Name, string? Version, ComponentGraph Graph);
