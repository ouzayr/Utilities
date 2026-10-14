using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PPSolutionExplorer.Parsers.Expressions;

/// <summary>
/// Extracts references from Workflow Definition Language expressions.
/// Only literal arguments are resolved. Anything computed is reported unresolved with the raw expression.
/// </summary>
public static partial class ExpressionScanner
{
    private static readonly Dictionary<string, ReferenceKind> Functions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["body"] = ReferenceKind.Action,
        ["outputs"] = ReferenceKind.Action,
        ["actions"] = ReferenceKind.Action,
        ["result"] = ReferenceKind.Action,
        ["items"] = ReferenceKind.LoopItem,
        ["triggerBody"] = ReferenceKind.Trigger,
        ["triggerOutputs"] = ReferenceKind.Trigger,
        ["trigger"] = ReferenceKind.Trigger,
        ["variables"] = ReferenceKind.Variable,
        ["parameters"] = ReferenceKind.Parameter,
        ["workflow"] = ReferenceKind.Workflow,
    };

    /// <summary>Returns the expressions embedded in a JSON string value (<c>@...</c> and <c>@{...}</c>).</summary>
    public static IEnumerable<string> ExpressionsIn(string value)
    {
        if (string.IsNullOrEmpty(value) || !value.Contains('@'))
        {
            yield break;
        }

        // "@@" escapes a literal "@" at the start of a string.
        if (value.StartsWith("@@", StringComparison.Ordinal))
        {
            yield break;
        }

        if (value.StartsWith('@') && !value.StartsWith("@{", StringComparison.Ordinal))
        {
            yield return value[1..];
            yield break;
        }

        var index = 0;
        while ((index = value.IndexOf("@{", index, StringComparison.Ordinal)) >= 0)
        {
            var end = FindClosingBrace(value, index + 2);
            if (end < 0)
            {
                yield return value[(index + 2)..];
                yield break;
            }

            yield return value[(index + 2)..end];
            index = end + 1;
        }
    }

    /// <summary>Scans every string in a JSON element (keys included) and returns all references.</summary>
    public static IReadOnlyList<ExpressionReference> Scan(JsonElement element)
    {
        var results = new List<ExpressionReference>();
        Walk(element, results);
        return results;
    }

    public static IReadOnlyList<ExpressionReference> ScanExpression(string expression)
    {
        var results = new List<ExpressionReference>();
        foreach (Match match in FunctionCall().Matches(expression))
        {
            var function = match.Groups["fn"].Value;
            if (!Functions.TryGetValue(function, out var kind) || IsInsideStringLiteral(expression, match.Index))
            {
                continue;
            }

            var argStart = match.Index + match.Length;
            var name = ReadLiteralArgument(expression, argStart, out var noArgs);
            if (kind is ReferenceKind.Trigger or ReferenceKind.Workflow)
            {
                results.Add(new ExpressionReference(kind, function, null, expression));
                continue;
            }

            if (kind == ReferenceKind.LoopItem && noArgs)
            {
                // items() without a name is invalid in cloud flows; never guess the loop.
                results.Add(new ExpressionReference(kind, function, null, expression));
                continue;
            }

            results.Add(new ExpressionReference(kind, function, name, expression));
        }

        return results;
    }

    private static void Walk(JsonElement element, List<ExpressionReference> results)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                foreach (var expression in ExpressionsIn(element.GetString()!))
                {
                    results.AddRange(ScanExpression(expression));
                }

                break;
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    foreach (var expression in ExpressionsIn(property.Name))
                    {
                        results.AddRange(ScanExpression(expression));
                    }

                    Walk(property.Value, results);
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    Walk(item, results);
                }

                break;
        }
    }

    /// <summary>Reads a single-quoted literal first argument. Returns null if the argument is computed.</summary>
    private static string? ReadLiteralArgument(string expression, int index, out bool noArgs)
    {
        noArgs = false;
        while (index < expression.Length && char.IsWhiteSpace(expression[index]))
        {
            index++;
        }

        if (index < expression.Length && expression[index] == ')')
        {
            noArgs = true;
            return null;
        }

        if (index >= expression.Length || expression[index] != '\'')
        {
            return null;
        }

        var builder = new StringBuilder();
        index++;
        while (index < expression.Length)
        {
            var c = expression[index];
            if (c == '\'')
            {
                if (index + 1 < expression.Length && expression[index + 1] == '\'')
                {
                    builder.Append('\'');
                    index += 2;
                    continue;
                }

                index++;
                break;
            }

            builder.Append(c);
            index++;
        }

        while (index < expression.Length && char.IsWhiteSpace(expression[index]))
        {
            index++;
        }

        // body('a' & 'b') style concatenation is not WDL, but guard anyway: only ')' or ',' may follow.
        return index < expression.Length && expression[index] is ')' or ',' ? builder.ToString() : null;
    }

    private static bool IsInsideStringLiteral(string expression, int position)
    {
        var inside = false;
        for (var i = 0; i < position; i++)
        {
            if (expression[i] == '\'')
            {
                inside = !inside;
            }
        }

        return inside;
    }

    private static int FindClosingBrace(string value, int start)
    {
        var depth = 0;
        var inString = false;
        for (var i = start; i < value.Length; i++)
        {
            var c = value[i];
            if (c == '\'')
            {
                inString = !inString;
            }
            else if (!inString && c == '{')
            {
                depth++;
            }
            else if (!inString && c == '}')
            {
                if (depth == 0)
                {
                    return i;
                }

                depth--;
            }
        }

        return -1;
    }

    [GeneratedRegex(@"(?<![\w.])(?<fn>[A-Za-z]+)\s*\(")]
    private static partial Regex FunctionCall();
}
