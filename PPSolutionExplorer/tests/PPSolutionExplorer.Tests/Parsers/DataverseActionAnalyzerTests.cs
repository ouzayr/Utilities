using System.Text.Json;
using PPSolutionExplorer.Parsers.Dataverse;

namespace PPSolutionExplorer.Tests.Parsers;

public class DataverseActionAnalyzerTests
{
    private static DataverseOperation Analyse(string operation, string parameters) =>
        DataverseActionAnalyzer.Analyse(operation, JsonDocument.Parse(parameters).RootElement);

    [Fact]
    public void List_rows_reads_select_filter_and_orderby_columns()
    {
        var result = Analyse("ListRecords", """
            { "entityName": "accounts", "$select": "name,revenue", "$filter": "statecode eq 0 and contains(name, 'x') and primarycontactid/fullname ne null", "$orderby": "createdon desc" }
            """);
        Assert.Equal(DataverseAccess.Read, result.Access);
        Assert.Equal("accounts", result.Table);
        Assert.Equal(["name", "revenue", "statecode", "primarycontactid", "createdon"], result.ReadColumns);
    }

    [Fact]
    public void Create_writes_item_columns_including_lookups()
    {
        var result = Analyse("CreateRecord", """
            { "entityName": "accounts", "item/name": "x", "item/parentaccountid@odata.bind": "accounts(1)" }
            """);
        Assert.Equal(DataverseAccess.Write, result.Access);
        Assert.Equal(["name", "parentaccountid"], result.WrittenColumns);
    }

    [Fact]
    public void Dynamic_table_name_is_unresolved()
    {
        var result = Analyse("ListRecords", """{ "entityName": "@variables('table')" }""");
        Assert.Null(result.Table);
        Assert.Equal("@variables('table')", result.RawTableExpression);
    }

    [Fact]
    public void Values_inside_filter_expressions_are_not_columns()
    {
        var result = Analyse("ListRecords", """{ "entityName": "contacts", "$filter": "lastname eq '@{body('x')?['eq']}'" }""");
        Assert.Equal(["lastname"], result.ReadColumns);
    }
}
