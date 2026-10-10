namespace PPSolutionExplorer.Parsers.Dataverse;

public enum DataverseAccess
{
    None,
    Read,
    Write,
    Trigger,
}

public sealed record DataverseOperation(
    DataverseAccess Access,
    string? Table,
    string? RawTableExpression,
    IReadOnlyList<string> ReadColumns,
    IReadOnlyList<string> WrittenColumns,
    IReadOnlyList<string> UnresolvedColumns);
