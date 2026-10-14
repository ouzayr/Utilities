namespace PPSolutionExplorer.Core.Model;

public enum EdgeType
{
    /// <summary>Source runs before target. Target's runAfter status set is on the edge.</summary>
    RunsAfter,

    /// <summary>Target reads the output of source via an expression.</summary>
    DataFlow,

    /// <summary>Action reads a table or column.</summary>
    Reads,

    /// <summary>Action writes a table or column.</summary>
    Writes,

    /// <summary>Action calls a child flow.</summary>
    Calls,

    /// <summary>Source (e.g. a table) triggers the target flow.</summary>
    Triggers,

    UsesEnvVar,
    UsesConnection,

    /// <summary>Parent/child nesting.</summary>
    Contains,
}
