namespace PPSolutionExplorer.Core.Model;

/// <summary>
/// A reference that cannot be resolved deterministically (dynamic expression, computed table name...)
/// or that points at something that does not exist (broken). Stored with the raw expression. Never inferred.
/// </summary>
public sealed record UnresolvedReference(string NodeId, string RawExpression, string Reason)
{
    public const string BrokenPrefix = "broken: ";

    /// <summary>The target is known not to exist (as opposed to being computed at run time).</summary>
    public bool IsBroken => Reason.StartsWith(BrokenPrefix, StringComparison.Ordinal);

    public static string Broken(string reason) => BrokenPrefix + reason;
}
