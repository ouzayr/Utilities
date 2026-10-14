using PPSolutionExplorer.Parsers.Expressions;

namespace PPSolutionExplorer.Tests.Parsers;

public class ExpressionScannerTests
{
    [Theory]
    [InlineData("@body('Get_item')?['value']", ReferenceKind.Action, "Get_item")]
    [InlineData("@outputs('Compose')", ReferenceKind.Action, "Compose")]
    [InlineData("@items('Apply_to_each')?['id']", ReferenceKind.LoopItem, "Apply_to_each")]
    [InlineData("@variables('count')", ReferenceKind.Variable, "count")]
    [InlineData("@parameters('Site (new_Site)')", ReferenceKind.Parameter, "Site (new_Site)")]
    [InlineData("@body('It''s_here')", ReferenceKind.Action, "It's_here")]
    public void Resolves_literal_arguments(string value, ReferenceKind kind, string name)
    {
        var refs = ExpressionScanner.ExpressionsIn(value).SelectMany(ExpressionScanner.ScanExpression).ToList();
        var reference = Assert.Single(refs);
        Assert.Equal(kind, reference.Kind);
        Assert.Equal(name, reference.Name);
    }

    [Fact]
    public void Interpolations_are_all_found()
    {
        var refs = ExpressionScanner.ExpressionsIn("Hello @{triggerBody()?['name']} from @{outputs('A')} and @{body('B')}")
            .SelectMany(ExpressionScanner.ScanExpression).ToList();
        Assert.Equal(3, refs.Count);
        Assert.Equal(["A", "B"], refs.Where(r => r.Kind == ReferenceKind.Action).Select(r => r.Name));
    }

    [Fact]
    public void Computed_arguments_are_unresolved()
    {
        var refs = ExpressionScanner.ScanExpression("body(concat('Get_', variables('x')))");
        var body = refs.Single(r => r.Function == "body");
        Assert.Null(body.Name);
        Assert.False(body.IsResolved);
        Assert.Contains(refs, r => r.Kind == ReferenceKind.Variable && r.Name == "x");
    }

    [Fact]
    public void Function_names_inside_string_literals_are_ignored()
    {
        Assert.Empty(ExpressionScanner.ScanExpression("concat('see body(', 'x')"));
    }

    [Fact]
    public void Escaped_at_sign_is_not_an_expression()
    {
        Assert.Empty(ExpressionScanner.ExpressionsIn("@@body('x')"));
        Assert.Empty(ExpressionScanner.ExpressionsIn("mail@example.invalid"));
    }
}
