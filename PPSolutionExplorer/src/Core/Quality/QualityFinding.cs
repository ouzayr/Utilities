namespace PPSolutionExplorer.Core.Quality;

public enum Severity
{
    Info,
    Warning,
    Error,
}

public sealed record QualityFinding(string RuleId, Severity Severity, string NodeId, string Message, string? Evidence = null);
