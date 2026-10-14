using System.Text.Json;
using System.Text.RegularExpressions;

namespace PPSolutionExplorer.Parsers.Dataverse;

/// <summary>
/// Extracts table and column usage from Dataverse connector actions and triggers.
/// </summary>
public static partial class DataverseActionAnalyzer
{
    public const string ConnectorApiName = "shared_commondataserviceforapps";

    private static readonly HashSet<string> ReadOperations = new(StringComparer.OrdinalIgnoreCase)
    {
        "ListRecords", "ListRecordsWithOrganization", "GetItem", "GetItemWithOrganization",
        "GetRelatedRecords", "GetEntityFileImageFieldContent", "GetEntityFileImageFieldContentWithOrganization",
    };

    private static readonly HashSet<string> WriteOperations = new(StringComparer.OrdinalIgnoreCase)
    {
        "CreateRecord", "CreateRecordWithOrganization", "UpdateRecord", "UpdateRecordWithOrganization",
        "UpdateOnlyRecord", "UpdateOnlyRecordWithOrganization", "DeleteRecord", "DeleteRecordWithOrganization",
        "AssociateEntities", "AssociateEntitiesWithOrganization", "DisassociateEntities", "DisassociateEntitiesWithOrganization",
        "PerformBoundAction", "PerformBoundActionWithOrganization", "UpdateEntityFileImageFieldContent", "UploadFile",
    };

    private static readonly HashSet<string> TriggerOperations = new(StringComparer.OrdinalIgnoreCase)
    {
        "SubscribeWebhookTrigger", "SubscribeWebhookTriggerWithOrganization",
    };

    private static readonly HashSet<string> ODataKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "and", "or", "not", "eq", "ne", "gt", "ge", "lt", "le", "null", "true", "false", "asc", "desc",
        "contains", "startswith", "endswith", "any", "all", "in", "has",
    };

    public static bool IsDataverse(string? apiIdOrName) =>
        apiIdOrName is not null && apiIdOrName.Contains(ConnectorApiName, StringComparison.OrdinalIgnoreCase);

    public static DataverseOperation Analyse(string operationId, JsonElement parameters)
    {
        var access = TriggerOperations.Contains(operationId) ? DataverseAccess.Trigger
            : ReadOperations.Contains(operationId) ? DataverseAccess.Read
            : WriteOperations.Contains(operationId) ? DataverseAccess.Write
            : DataverseAccess.None;

        if (parameters.ValueKind != JsonValueKind.Object)
        {
            return new DataverseOperation(access, null, null, [], [], []);
        }

        var tableRaw = String(parameters, "entityName") ?? String(parameters, "subscriptionRequest/entityname");
        string? table = null;
        string? rawTableExpression = null;
        if (tableRaw is not null)
        {
            if (tableRaw.Contains('@'))
            {
                rawTableExpression = tableRaw;
            }
            else
            {
                table = tableRaw.Trim();
            }
        }

        var read = new List<string>();
        var written = new List<string>();
        var unresolved = new List<string>();

        AddSelect(String(parameters, "$select"), read, unresolved);
        AddFilter(String(parameters, "$filter"), read, unresolved);
        AddFilter(String(parameters, "subscriptionRequest/filterexpression"), read, unresolved);
        AddOrderBy(String(parameters, "$orderby"), read, unresolved);
        AddSelect(String(parameters, "subscriptionRequest/filteringattributes"), read, unresolved);

        foreach (var property in parameters.EnumerateObject())
        {
            if (property.Name.StartsWith("item/", StringComparison.OrdinalIgnoreCase))
            {
                var column = property.Name["item/".Length..];
                var slash = column.IndexOf('/');
                if (slash >= 0)
                {
                    column = column[..slash];
                }

                // Lookups are written as "item/parentaccountid@odata.bind".
                var at = column.IndexOf('@');
                if (at >= 0)
                {
                    column = column[..at];
                }

                if (column.Length > 0)
                {
                    written.Add(column.ToLowerInvariant());
                }
            }
        }

        return new DataverseOperation(
            access,
            table,
            rawTableExpression,
            read.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            written.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            unresolved);
    }

    private static string? String(JsonElement parameters, string name) =>
        parameters.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static void AddSelect(string? value, List<string> columns, List<string> unresolved)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        if (value.Contains('@'))
        {
            unresolved.Add(value);
            return;
        }

        columns.AddRange(value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(c => Identifier().IsMatch(c))
            .Select(c => c.ToLowerInvariant()));
    }

    private static void AddOrderBy(string? value, List<string> columns, List<string> unresolved)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        if (value.Contains('@'))
        {
            unresolved.Add(value);
            return;
        }

        foreach (var part in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var column = part.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
            if (Identifier().IsMatch(column))
            {
                columns.Add(column.ToLowerInvariant());
            }
        }
    }

    private static void AddFilter(string? value, List<string> columns, List<string> unresolved)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        // Expressions inside the filter make the *values* dynamic; column names are usually still literal.
        // Anything inside @{...} or quotes is stripped before scanning for identifiers.
        if (value.TrimStart().StartsWith('@') && !value.TrimStart().StartsWith("@{", StringComparison.Ordinal))
        {
            unresolved.Add(value);
            return;
        }

        var cleaned = InterpolatedExpression().Replace(value, " ");
        cleaned = QuotedLiteral().Replace(cleaned, " ");

        foreach (Match match in FilterComparison().Matches(cleaned))
        {
            AddIdentifier(match.Groups["col"].Value, columns);
        }

        foreach (Match match in FilterFunction().Matches(cleaned))
        {
            AddIdentifier(match.Groups["col"].Value, columns);
        }
    }

    private static void AddIdentifier(string candidate, List<string> columns)
    {
        // Navigation paths ("parentaccountid/name") keep the first segment: the column on this table.
        var column = candidate.Split('/')[0];
        if (Identifier().IsMatch(column) && !ODataKeywords.Contains(column))
        {
            columns.Add(column.ToLowerInvariant());
        }
    }

    [GeneratedRegex(@"^[A-Za-z_][A-Za-z0-9_]*$")]
    private static partial Regex Identifier();

    [GeneratedRegex(@"@\{[^}]*\}")]
    private static partial Regex InterpolatedExpression();

    [GeneratedRegex(@"'(?:[^']|'')*'")]
    private static partial Regex QuotedLiteral();

    [GeneratedRegex(@"(?<col>[A-Za-z_][A-Za-z0-9_/]*)\s+(eq|ne|gt|ge|lt|le)\b", RegexOptions.IgnoreCase)]
    private static partial Regex FilterComparison();

    [GeneratedRegex(@"\b(contains|startswith|endswith)\s*\(\s*(?<col>[A-Za-z_][A-Za-z0-9_/]*)", RegexOptions.IgnoreCase)]
    private static partial Regex FilterFunction();
}
