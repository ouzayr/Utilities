namespace CodeCartographer.ScannerDotnet;

public sealed class ApiLintRules
{
    public void Run(ExtractionContext ctx)
    {
        // Security: actions without [Authorize] and not [AllowAnonymous].
        foreach (var n in ctx.Result.Nodes.Where(n => n.Kind == "dotnet-action"))
        {
            var auth = (bool?)n.Meta.GetValueOrDefault("authorize") ?? false;
            var anon = (bool?)n.Meta.GetValueOrDefault("allowAnonymous") ?? false;
            if (!auth && !anon)
            {
                ctx.Result.Findings.Add(new Finding
                {
                    Id = $"sec:no-authz:{n.Id}",
                    RuleId = "security/missing-authorize",
                    Severity = "warn",
                    Category = "security",
                    Title = $"Action without [Authorize]: {n.Name}",
                    Detail = "Action does not have [Authorize] or [AllowAnonymous]. Confirm this is intentional.",
                    NodeId = n.Id,
                    FilePath = n.FilePath,
                    Line = n.Line,
                });
            }
        }

        // Layering: controller calling repository directly (skip-service).
        var idToNode = ctx.Result.Nodes.ToDictionary(n => n.Id);
        foreach (var e in ctx.Result.Edges.Where(e => e.Kind == "calls"))
        {
            if (!idToNode.TryGetValue(e.Source, out var src) || !idToNode.TryGetValue(e.Target, out var tgt)) continue;
            if (src.Kind == "dotnet-controller" && tgt.Kind == "dotnet-repository")
            {
                ctx.Result.Findings.Add(new Finding
                {
                    Id = $"layer:ctrl-repo:{src.Id}->{tgt.Id}",
                    RuleId = "layering/controller-calls-repository-directly",
                    Severity = "warn",
                    Category = "layering",
                    Title = $"Controller calls repository directly: {src.Name} → {tgt.Name}",
                    Detail = "Prefer routing through a service for testability and a single layering boundary.",
                    NodeId = src.Id,
                    FilePath = src.FilePath,
                    Line = src.Line,
                });
            }
        }

        // Architecture: action node without parameters[*].fromBody on a write verb is suspicious.
        foreach (var n in ctx.Result.Nodes.Where(n => n.Kind == "dotnet-action"))
        {
            var verb = (string?)n.Meta.GetValueOrDefault("verb");
            if (verb is not ("POST" or "PUT" or "PATCH")) continue;
            var parameters = n.Meta.GetValueOrDefault("parameters") as System.Collections.IEnumerable;
            if (parameters is null) continue;
            var hasBody = false;
            foreach (var p in parameters)
            {
                if (p is null) continue;
                var pType = p.GetType();
                var fromBody = pType.GetProperty("fromBody")?.GetValue(p);
                if (fromBody is true) { hasBody = true; break; }
            }
            if (!hasBody)
            {
                ctx.Result.Findings.Add(new Finding
                {
                    Id = $"arch:write-no-body:{n.Id}",
                    RuleId = "architecture/write-action-without-body",
                    Severity = "info",
                    Category = "architecture",
                    Title = $"Write action without [FromBody]: {n.Name}",
                    Detail = $"{verb} action does not declare any [FromBody] parameter. Confirm payload contract.",
                    NodeId = n.Id,
                    FilePath = n.FilePath,
                    Line = n.Line,
                });
            }
        }
    }
}
