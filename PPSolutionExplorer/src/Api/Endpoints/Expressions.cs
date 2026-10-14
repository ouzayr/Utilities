using System.Text.Json;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers.Expressions;

namespace PPSolutionExplorer.Api.Endpoints;

public sealed record ExpressionInfo(int Index, string Path, string Expression, IReadOnlyList<ExpressionReference> References);

/// <summary>Expressions in a step's stored source, in document order. The index is stable for a given import.</summary>
public static class Expressions
{
    public static IReadOnlyList<ExpressionInfo> Of(GraphNode node)
    {
        if (node.RawJson is null)
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(node.RawJson);
            return ExpressionScanner.AllExpressions(doc.RootElement)
                .Select((e, i) => new ExpressionInfo(i, e.Path, e.Expression, ExpressionScanner.ScanExpression(e.Expression)))
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
