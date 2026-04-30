using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class DiExtractor
{
    private static readonly string[] DiMethods = { "AddScoped", "AddSingleton", "AddTransient", "AddHostedService" };

    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            foreach (var inv in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (inv.Expression is not MemberAccessExpressionSyntax m) continue;
                var name = m.Name switch
                {
                    GenericNameSyntax g => g.Identifier.Text,
                    IdentifierNameSyntax i => i.Identifier.Text,
                    _ => string.Empty,
                };
                if (!DiMethods.Contains(name)) continue;
                if (m.Name is not GenericNameSyntax gen) continue;
                var typeArgs = gen.TypeArgumentList.Arguments.Select(a => a.ToString()).ToArray();
                if (typeArgs.Length == 0) continue;

                // Synthesise a "registers" edge from the registering method's project.
                var ifaceName = typeArgs[0];
                var implName = typeArgs.Length > 1 ? typeArgs[1] : typeArgs[0];

                var ifaceKey = ctx.NodesByFq.Keys.FirstOrDefault(k => k.EndsWith("." + ifaceName) || k == ifaceName);
                var implKey = ctx.NodesByFq.Keys.FirstOrDefault(k => k.EndsWith("." + implName) || k == implName);

                if (ifaceKey is null || implKey is null) continue;
                var ifaceNode = ctx.NodesByFq[ifaceKey];
                var implNode = ctx.NodesByFq[implKey];
                ctx.Result.Edges.Add(new GraphEdge
                {
                    Id = Ids.EdgeId("registers", ifaceNode.Id, implNode.Id, name),
                    Source = ifaceNode.Id,
                    Target = implNode.Id,
                    Kind = "registers",
                    Meta = new() { ["lifetime"] = name },
                });
            }
        }
    }
}
