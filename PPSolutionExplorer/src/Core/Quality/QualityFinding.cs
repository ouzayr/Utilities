namespace PPSolutionExplorer.Core.Quality;

public enum Severity
{
    Info,
    Warning,
    Error,
}

public sealed record QualityFinding(string RuleId, Severity Severity, string NodeId, string Message, string? Evidence = null);

/// <param name="Category">reliability, performance, security, maintainability.</param>
public sealed record RuleDefinition(string Id, string Title, string Category, Severity DefaultSeverity, string Description);
