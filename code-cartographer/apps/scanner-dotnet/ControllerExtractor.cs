using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class ControllerExtractor
{
    private static readonly string[] HttpAttrs = { "HttpGet", "HttpPost", "HttpPut", "HttpDelete", "HttpPatch", "HttpHead", "HttpOptions" };

    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var model = compilation.GetSemanticModel(tree);
            var root = tree.GetRoot();
            foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (!IsController(cls)) continue;
                var symbol = model.GetDeclaredSymbol(cls);
                if (symbol is null) continue;

                var rel = ctx.Rel(tree.FilePath);
                var className = symbol.Name;
                var fq = $"{rel}#{className}";
                var ctrlNode = new GraphNode
                {
                    Id = Ids.NodeId("api", "dotnet-controller", fq, ctx.Project),
                    Kind = "dotnet-controller",
                    Side = "api",
                    Project = ctx.Project,
                    Name = className,
                    FqName = fq,
                    FilePath = rel,
                    Line = cls.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                    Meta = new()
                    {
                        ["fullName"] = symbol.ToDisplayString(),
                        ["routePrefix"] = ResolveControllerRoute(cls, className),
                    },
                };
                ctx.Result.Nodes.Add(ctrlNode);
                ctx.NodesByFq[symbol.ToDisplayString()] = ctrlNode;

                foreach (var m in cls.Members.OfType<MethodDeclarationSyntax>())
                {
                    if (!m.Modifiers.Any(SyntaxKind.PublicKeyword)) continue;
                    var (verb, template) = ResolveActionRoute(m);
                    if (verb is null) continue;
                    var prefix = (string?)ctrlNode.Meta["routePrefix"] ?? string.Empty;
                    var fullRoute = NormaliseRoute(JoinRoute(prefix, template ?? string.Empty));
                    var actionFq = $"{fq}.{m.Identifier.Text}";
                    var msym = model.GetDeclaredSymbol(m);
                    var actionNode = new GraphNode
                    {
                        Id = Ids.NodeId("api", "dotnet-action", actionFq, ctx.Project),
                        Kind = "dotnet-action",
                        Side = "api",
                        Project = ctx.Project,
                        Name = $"{verb} {fullRoute}",
                        FqName = actionFq,
                        FilePath = rel,
                        Line = m.GetLocation().GetLineSpan().StartLinePosition.Line + 1,
                        Meta = new()
                        {
                            ["controller"] = className,
                            ["method"] = m.Identifier.Text,
                            ["verb"] = verb,
                            ["route"] = fullRoute,
                            ["authorize"] = HasAttr(m, "Authorize") || HasAttr(cls, "Authorize"),
                            ["allowAnonymous"] = HasAttr(m, "AllowAnonymous"),
                            ["returnType"] = msym?.ReturnType.ToDisplayString(),
                            ["parameters"] = m.ParameterList.Parameters.Select(p => new
                            {
                                name = p.Identifier.Text,
                                type = p.Type?.ToString(),
                                fromBody = HasAttr(p, "FromBody"),
                                fromRoute = HasAttr(p, "FromRoute"),
                                fromQuery = HasAttr(p, "FromQuery"),
                            }).Cast<object?>().ToList(),
                        },
                    };
                    ctx.Result.Nodes.Add(actionNode);
                    ctx.Result.Edges.Add(new GraphEdge
                    {
                        Id = Ids.EdgeId("declares", ctrlNode.Id, actionNode.Id),
                        Source = ctrlNode.Id,
                        Target = actionNode.Id,
                        Kind = "declares",
                        Meta = new(),
                    });
                    if (msym is not null)
                    {
                        ctx.NodesByFq[msym.ToDisplayString()] = actionNode;
                    }
                }
            }
        }
    }

    private static bool IsController(ClassDeclarationSyntax cls)
    {
        if (HasAttr(cls, "ApiController")) return true;
        if (cls.BaseList is null) return false;
        return cls.BaseList.Types.Any(t => t.Type.ToString().Contains("ControllerBase") || t.Type.ToString().EndsWith("Controller"));
    }

    private static bool HasAttr(SyntaxNode node, string name)
    {
        return node.ChildNodes().OfType<AttributeListSyntax>()
            .SelectMany(al => al.Attributes)
            .Any(a => a.Name.ToString().Split('.').Last() == name || a.Name.ToString().Split('.').Last() == name + "Attribute");
    }

    private static bool HasAttr(ParameterSyntax node, string name)
    {
        return node.AttributeLists.SelectMany(al => al.Attributes)
            .Any(a => a.Name.ToString().Split('.').Last() == name || a.Name.ToString().Split('.').Last() == name + "Attribute");
    }

    private static string ResolveControllerRoute(ClassDeclarationSyntax cls, string className)
    {
        foreach (var attrList in cls.AttributeLists)
        {
            foreach (var attr in attrList.Attributes)
            {
                var n = attr.Name.ToString().Split('.').Last();
                if (n is "Route" or "RouteAttribute")
                {
                    var arg = attr.ArgumentList?.Arguments.FirstOrDefault();
                    if (arg?.Expression is LiteralExpressionSyntax lit) return ApplyTokens(lit.Token.ValueText, className);
                }
            }
        }
        return string.Empty;
    }

    private static (string? verb, string? template) ResolveActionRoute(MethodDeclarationSyntax m)
    {
        foreach (var attrList in m.AttributeLists)
        {
            foreach (var attr in attrList.Attributes)
            {
                var n = attr.Name.ToString().Split('.').Last().Replace("Attribute", "");
                if (HttpAttrs.Contains(n))
                {
                    var verb = n.Replace("Http", "").ToUpperInvariant();
                    var arg = attr.ArgumentList?.Arguments.FirstOrDefault();
                    var tpl = arg?.Expression is LiteralExpressionSyntax lit ? lit.Token.ValueText : null;
                    return (verb, tpl);
                }
                if (n is "Route")
                {
                    var arg = attr.ArgumentList?.Arguments.FirstOrDefault();
                    var tpl = arg?.Expression is LiteralExpressionSyntax lit ? lit.Token.ValueText : null;
                    return ("GET", tpl);
                }
            }
        }
        return (null, null);
    }

    private static string ApplyTokens(string template, string className)
    {
        var ctrl = className.EndsWith("Controller") ? className[..^"Controller".Length] : className;
        return template.Replace("[controller]", ctrl, StringComparison.OrdinalIgnoreCase);
    }

    private static string JoinRoute(string a, string b)
    {
        if (string.IsNullOrEmpty(a)) return b;
        if (string.IsNullOrEmpty(b)) return a;
        return a.TrimEnd('/') + "/" + b.TrimStart('/');
    }

    private static string NormaliseRoute(string r)
    {
        if (string.IsNullOrEmpty(r)) return "/";
        var withSlash = r.StartsWith("/") ? r : "/" + r;
        // Replace {id} or {id:int} with :id
        var noConstraints = System.Text.RegularExpressions.Regex.Replace(withSlash, "\\{(\\w+)(?::[^}]+)?\\}", ":$1");
        return noConstraints.ToLowerInvariant();
    }
}
