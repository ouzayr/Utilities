using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class EntityExtractor
{
    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (cls.BaseList is null) continue;
                var isDbContext = cls.BaseList.Types.Any(t => t.Type.ToString().Contains("DbContext"));
                if (!isDbContext) continue;
                var sym = model.GetDeclaredSymbol(cls);
                if (sym is null) continue;
                foreach (var prop in cls.Members.OfType<PropertyDeclarationSyntax>())
                {
                    if (prop.Type is not GenericNameSyntax gen) continue;
                    if (gen.Identifier.Text != "DbSet") continue;
                    var entityType = gen.TypeArgumentList.Arguments.FirstOrDefault()?.ToString();
                    if (entityType is null) continue;

                    var rel = ctx.Rel(tree.FilePath);
                    var fq = $"{rel}#{entityType}";
                    if (ctx.NodesByFq.Values.Any(n => n.Kind == "dotnet-entity" && n.Name == entityType)) continue;
                    var node = new GraphNode
                    {
                        Id = Ids.NodeId("api", "dotnet-entity", fq, ctx.Project),
                        Kind = "dotnet-entity",
                        Side = "api",
                        Project = ctx.Project,
                        Name = entityType,
                        FqName = fq,
                        FilePath = rel,
                        Line = prop.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                        Meta = new() { ["dbContext"] = sym.Name, ["dbSetProperty"] = prop.Identifier.Text },
                    };
                    ctx.Result.Nodes.Add(node);
                    ctx.NodesByFq[entityType] = node;
                }
            }
        }
    }
}
