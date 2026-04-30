using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeCartographer.ScannerDotnet;

public sealed class MinimalApiExtractor
{
    private static readonly string[] MapMethods = { "MapGet", "MapPost", "MapPut", "MapDelete", "MapPatch", "MapMethods" };

    public void Extract(Compilation compilation, ExtractionContext ctx)
    {
        foreach (var tree in compilation.SyntaxTrees)
        {
            var root = tree.GetRoot();
            foreach (var inv in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (inv.Expression is not MemberAccessExpressionSyntax m) continue;
                if (m.Name is not IdentifierNameSyntax id) continue;
                if (!MapMethods.Contains(id.Identifier.Text)) continue;
                var args = inv.ArgumentList.Arguments;
                if (args.Count == 0) continue;
                if (args[0].Expression is not LiteralExpressionSyntax lit) continue;
                var route = lit.Token.ValueText;
                var verb = id.Identifier.Text.Replace("Map", "").ToUpperInvariant();
                if (verb == "METHODS") verb = "ANY";
                var rel = ctx.Rel(tree.FilePath);
                var line = inv.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                var fq = $"{rel}:{line}#{verb} {route}";
                var node = new GraphNode
                {
                    Id = Ids.NodeId("api", "dotnet-endpoint", fq, ctx.Project),
                    Kind = "dotnet-endpoint",
                    Side = "api",
                    Project = ctx.Project,
                    Name = $"{verb} {route}",
                    FqName = fq,
                    FilePath = rel,
                    Line = line,
                    Meta = new()
                    {
                        ["verb"] = verb,
                        ["route"] = NormaliseRoute(route),
                        ["minimalApi"] = true,
                    },
                };
                ctx.Result.Nodes.Add(node);
            }
        }
    }

    private static string NormaliseRoute(string r)
    {
        if (string.IsNullOrEmpty(r)) return "/";
        var withSlash = r.StartsWith("/") ? r : "/" + r;
        var noConstraints = System.Text.RegularExpressions.Regex.Replace(withSlash, "\\{(\\w+)(?::[^}]+)?\\}", ":$1");
        return noConstraints.ToLowerInvariant();
    }
}
