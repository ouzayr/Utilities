namespace PPSolutionExplorer.Core.Model;

/// <summary>
/// A reference that cannot be resolved deterministically (dynamic expression, computed table name...).
/// Stored with the raw expression. Never inferred.
/// </summary>
public sealed record UnresolvedReference(string NodeId, string RawExpression, string Reason);
