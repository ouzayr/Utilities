using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class ServiceExtractor
{
    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            foreach (var iface in root.DescendantNodes().OfType<InterfaceDeclarationSyntax>())
            {
                var sym = model.GetDeclaredSymbol(iface);
                if (sym is null) continue;
                var rel = ctx.Rel(tree.FilePath);
                var fq = $"{rel}#{sym.Name}";
                var node = new GraphNode
                {
                    Id = Ids.NodeId("api", "dotnet-interface", fq, ctx.Project),
                    Kind = "dotnet-interface",
                    Side = "api",
                    Project = ctx.Project,
                    Name = sym.Name,
                    FqName = fq,
                    FilePath = rel,
                    Line = iface.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Meta = new() { ["fullName"] = sym.ToDisplayString() },
                };
                ctx.Result.Nodes.Add(node);
                ctx.NodesByFq[sym.ToDisplayString()] = node;
            }

            foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                var sym = model.GetDeclaredSymbol(cls);
                if (sym is null) continue;
                if (sym.Name.EndsWith("Controller")) continue;
                if (sym.Name.EndsWith("DbContext")) continue;
                if (ctx.NodesByFq.ContainsKey(sym.ToDisplayString())) continue;

                string kind = sym.Name.EndsWith("Repository") ? "dotnet-repository"
                    : sym.Name.EndsWith("Service") ? "dotnet-service"
                    : sym.Name.EndsWith("Validator") ? "dotnet-validator"
                    : sym.Name.EndsWith("Middleware") ? "dotnet-middleware"
                    : sym.Name.EndsWith("Handler") ? "dotnet-handler"
                    : sym.Name.EndsWith("Dto") || sym.Name.EndsWith("Request") || sym.Name.EndsWith("Response") ? "dotnet-dto"
                    : "dotnet-service"; // default bucket

                if (kind == "dotnet-service" && !((INamedTypeSymbol)sym).Interfaces.Any() && !sym.Name.EndsWith("Service")) continue;

                var rel = ctx.Rel(tree.FilePath);
                var fq = $"{rel}#{sym.Name}";
                var node = new GraphNode
                {
                    Id = Ids.NodeId("api", kind, fq, ctx.Project),
                    Kind = kind,
                    Side = "api",
                    Project = ctx.Project,
                    Name = sym.Name,
                    FqName = fq,
                    FilePath = rel,
                    Line = cls.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Meta = new() { ["fullName"] = sym.ToDisplayString() },
                };
                ctx.Result.Nodes.Add(node);
                ctx.NodesByFq[sym.ToDisplayString()] = node;

                foreach (var i in ((INamedTypeSymbol)sym).Interfaces)
                {
                    var ifaceKey = i.ToDisplayString();
                    if (ctx.NodesByFq.TryGetValue(ifaceKey, out var ifaceNode))
                    {
                        ctx.Result.Edges.Add(new GraphEdge
                        {
                            Id = Ids.EdgeId("implements", node.Id, ifaceNode.Id),
                            Source = node.Id,
                            Target = ifaceNode.Id,
                            Kind = "implements",
                            Meta = new(),
                        });
                    }
                }
            }
        }
    }
}
