namespace PPSolutionExplorer.Core.Model;

[Flags]
public enum RunStatus
{
    None = 0,
    Succeeded = 1,
    Failed = 2,
    Skipped = 4,
    TimedOut = 8,
}

public static class RunStatusExtensions
{
    public static RunStatus Parse(IEnumerable<string> values)
    {
        var result = RunStatus.None;
        foreach (var value in values)
        {
            if (Enum.TryParse<RunStatus>(value, ignoreCase: true, out var status))
            {
                result |= status;
            }
        }

        return result;
    }

    /// <summary>True when the edge is only taken on failure or timeout.</summary>
    public static bool IsFailureOnly(this RunStatus status) =>
        status != RunStatus.None && (status & (RunStatus.Succeeded | RunStatus.Skipped)) == RunStatus.None;
}
