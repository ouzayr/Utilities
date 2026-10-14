namespace PPSolutionExplorer.Parsers.Expressions;

public enum ReferenceKind
{
    /// <summary><c>body()</c>, <c>outputs()</c>, <c>actions()</c>, <c>result()</c>.</summary>
    Action,

    /// <summary><c>items()</c>.</summary>
    LoopItem,

    /// <summary><c>triggerBody()</c>, <c>triggerOutputs()</c>, <c>trigger()</c>.</summary>
    Trigger,

    /// <summary><c>variables()</c>.</summary>
    Variable,

    /// <summary><c>parameters()</c>.</summary>
    Parameter,

    /// <summary><c>workflow()</c>. Metadata only, no edge.</summary>
    Workflow,
}

/// <param name="Name">Literal argument. Null when the argument is not a string literal (unresolved).</param>
/// <param name="Expression">The full expression the reference was found in.</param>
public sealed record ExpressionReference(ReferenceKind Kind, string Function, string? Name, string Expression)
{
    public bool IsResolved => Name is not null || Kind is ReferenceKind.Trigger or ReferenceKind.Workflow;
}
