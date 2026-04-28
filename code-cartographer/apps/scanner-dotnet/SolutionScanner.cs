using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;

namespace CodeCartographer.ScannerDotnet;

/// <summary>
/// Walks every .cs file under <paramref name="root"/> using either an MSBuild workspace (if a .sln/.csproj is found)
/// or a syntax-only fallback. Extracts:
///   - controllers + actions (route templates composed)
///   - services + interfaces + repositories
///   - DTOs + entities (DbContext DbSet&lt;T&gt;)
///   - DI registrations
///   - call edges (method-to-method)
///   - minimal-API endpoints
/// </summary>
public sealed class SolutionScanner
{
    public async Task<ScanResult> ScanAsync(string root, string project)
    {
        var result = new ScanResult { Project = project, Side = "api" };

        // 1) Try MSBuild workspace first.
        var solution = Directory.GetFiles(root, "*.sln", SearchOption.AllDirectories).FirstOrDefault();
        var csprojs = Directory.GetFiles(root, "*.csproj", SearchOption.AllDirectories).Where(p => !p.Contains("/bin/") && !p.Contains("/obj/")).ToArray();

        var compilations = new List<Compilation>();
        var fileToProject = new Dictionary<string, string>();

        try
        {
            using var ws = MSBuildWorkspace.Create();
            ws.LoadMetadataForReferencedProjects = true;
            ws.WorkspaceFailed += (_, e) =>
            {
                if (e.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
                {
                    Console.Error.WriteLine($"[cc-scan-dotnet] workspace warning: {e.Diagnostic.Message}");
                }
            };
            if (solution is not null)
            {
                var sln = await ws.OpenSolutionAsync(solution);
                foreach (var p in sln.Projects)
                {
                    var c = await p.GetCompilationAsync();
                    if (c is not null) compilations.Add(c);
                    foreach (var doc in p.Documents)
                    {
                        if (doc.FilePath is not null) fileToProject[doc.FilePath] = p.Name;
                    }
                }
            }
            else
            {
                foreach (var csproj in csprojs)
                {
                    var p = await ws.OpenProjectAsync(csproj);
                    var c = await p.GetCompilationAsync();
                    if (c is not null) compilations.Add(c);
                    foreach (var doc in p.Documents)
                    {
                        if (doc.FilePath is not null) fileToProject[doc.FilePath] = p.Name;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[cc-scan-dotnet] MSBuildWorkspace failed: {ex.Message}");
            Console.Error.WriteLine("[cc-scan-dotnet] falling back to syntax-only scan");
        }

        if (compilations.Count == 0)
        {
            // Syntax-only fallback: no semantic info but still extract structural data.
            var trees = Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)
                .Where(p => !p.Contains("/bin/") && !p.Contains("/obj/") && !p.Contains("\\bin\\") && !p.Contains("\\obj\\"))
                .Select(p => CSharpSyntaxTree.ParseText(File.ReadAllText(p), path: p))
                .ToList();
            var compilation = CSharpCompilation.Create(project, trees);
            compilations.Add(compilation);
        }

        var ctx = new ExtractionContext
        {
            Root = root,
            Project = project,
            Result = result,
            FileToProject = fileToProject,
        };

        foreach (var compilation in compilations)
        {
            new ControllerExtractor().Extract(compilation, ctx);
            new ServiceExtractor().Extract(compilation, ctx);
            new EntityExtractor().Extract(compilation, ctx);
            new DiExtractor().Extract(compilation, ctx);
            new MinimalApiExtractor().Extract(compilation, ctx);
            new CallGraphExtractor().Extract(compilation, ctx);
        }

        new ApiLintRules().Run(ctx);

        result.Metrics["filesScanned"] = compilations.Sum(c => c.SyntaxTrees.Count());
        return result;
    }
}

public sealed class ExtractionContext
{
    public required string Root { get; init; }
    public required string Project { get; init; }
    public required ScanResult Result { get; init; }
    public required Dictionary<string, string> FileToProject { get; init; }

    public Dictionary<string, GraphNode> NodesByFq { get; } = new();

    public string Rel(string filePath) => Path.GetRelativePath(Root, filePath).Replace('\\', '/');
}
