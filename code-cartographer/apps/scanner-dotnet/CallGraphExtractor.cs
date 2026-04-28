using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class CallGraphExtractor
{
    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
            {
                var owner = method.Parent as ClassDeclarationSyntax;
                if (owner is null) continue;
                var ownerSym = model.GetDeclaredSymbol(owner);
                if (ownerSym is null) continue;
                var ownerKey = ownerSym.ToDisplayString();
                if (!ctx.NodesByFq.TryGetValue(ownerKey, out var ownerNode)) continue;

                foreach (var inv in method.DescendantNodes().OfType<InvocationExpressionSyntax>())
                {
                    var sym = model.GetSymbolInfo(inv).Symbol as IMethodSymbol;
                    if (sym is null) continue;
                    var containing = sym.ContainingType?.ToDisplayString();
                    if (containing is null) continue;
                    if (!ctx.NodesByFq.TryGetValue(containing, out var targetNode)) continue;
                    if (targetNode.Id == ownerNode.Id) continue;
                    ctx.Result.Edges.Add(new GraphEdge
                    {
                        Id = Ids.EdgeId("calls", ownerNode.Id, targetNode.Id, sym.Name),
                        Source = ownerNode.Id,
                        Target = targetNode.Id,
                        Kind = "calls",
                        Meta = new() { ["method"] = sym.Name },
                    });
                }
            }
        }
    }
}
