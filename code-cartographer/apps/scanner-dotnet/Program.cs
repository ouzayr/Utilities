using System.CommandLine;
using System.Text.Json;
using CodeCartographer.ScannerDotnet;
using Microsoft.Build.Locator;

if (!MSBuildLocator.IsRegistered)
{
    MSBuildLocator.RegisterDefaults();
}

// --- config file support ---
var fileConfig = LoadConfigFile();

var rootOption = new Option<DirectoryInfo?>("--root", "Path to the .NET solution root or a folder containing .csproj/.sln files");
var outOption = new Option<FileInfo?>("--out", "Output graph.json path");
var projectOption = new Option<string?>("--project", "Logical project key (defaults to folder name)");
var apiBaseOption = new Option<string?>("--api-base", "If set, POST graph.json to this API after writing it");
var scanIdOption = new Option<string?>("--scan-id", "Existing scan id (UUID) to merge into instead of creating a new scan");
var finalizeOption = new Option<bool>("--finalize", () => false, "Mark the scan as completed after this ingest");

var root = new RootCommand("cc-scan-dotnet — Roslyn-based scanner for .NET 8 APIs")
{
    rootOption,
    outOption,
    projectOption,
    apiBaseOption,
    scanIdOption,
    finalizeOption,
};

root.SetHandler(async (System.CommandLine.Invocation.InvocationContext ctx) =>
{
    var rootDir = ctx.ParseResult.GetValueForOption(rootOption)
        ?? (fileConfig.TryGetValue("root", out var cfgRoot) ? new DirectoryInfo(cfgRoot) : null);
    var outFile = ctx.ParseResult.GetValueForOption(outOption)
        ?? new FileInfo(fileConfig.TryGetValue("out", out var cfgOut) ? cfgOut : "graph.json");
    var project = ctx.ParseResult.GetValueForOption(projectOption)
        ?? (fileConfig.TryGetValue("project", out var cfgProj) ? cfgProj : null);
    var apiBase = ctx.ParseResult.GetValueForOption(apiBaseOption)
        ?? (fileConfig.TryGetValue("apiBase", out var cfgApi) ? cfgApi : null);
    var scanId = ctx.ParseResult.GetValueForOption(scanIdOption)
        ?? (fileConfig.TryGetValue("scanId", out var cfgScan) ? cfgScan : null);
    var finalize = ctx.ParseResult.GetValueForOption(finalizeOption)
        || (fileConfig.TryGetValue("finalize", out var cfgFin) && bool.TryParse(cfgFin, out var fin) && fin);

    if (rootDir is null)
    {
        Console.Error.WriteLine("[cc-scan-dotnet] --root is required (or set \"root\" in cc-scan-config.json)");
        ctx.ExitCode = 2;
        return;
    }
    if (!rootDir.Exists)
    {
        Console.Error.WriteLine($"[cc-scan-dotnet] root does not exist: {rootDir.FullName}");
        ctx.ExitCode = 2;
        return;
    }
    project ??= rootDir.Name;
    var sw = System.Diagnostics.Stopwatch.StartNew();
    var scanner = new SolutionScanner();
    var result = await scanner.ScanAsync(rootDir.FullName, project);
    sw.Stop();
    result.Metrics["msTaken"] = sw.ElapsedMilliseconds;

    Directory.CreateDirectory(outFile.Directory!.FullName);
    var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
    await File.WriteAllTextAsync(outFile.FullName, json);
    Console.WriteLine($"[cc-scan-dotnet] wrote {result.Nodes.Count} nodes, {result.Edges.Count} edges, {result.Findings.Count} findings → {outFile.FullName}");

    if (!string.IsNullOrWhiteSpace(apiBase))
    {
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(scanId)) query.Add($"scanId={Uri.EscapeDataString(scanId)}");
        if (finalize) query.Add("finalize=true");
        var qs = query.Count > 0 ? "?" + string.Join('&', query) : "";
        var url = apiBase.TrimEnd('/') + "/api/graph/ingest" + qs;
        Console.WriteLine($"[cc-scan-dotnet] POST {url}");
        using var http = new HttpClient();
        using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        var resp = await http.PostAsync(url, content);
        if (!resp.IsSuccessStatusCode)
        {
            Console.Error.WriteLine($"[cc-scan-dotnet] ingest failed: {(int)resp.StatusCode} {await resp.Content.ReadAsStringAsync()}");
            ctx.ExitCode = 3;
            return;
        }
        Console.WriteLine("[cc-scan-dotnet] ingest ok");
    }
});

return await root.InvokeAsync(args);

static Dictionary<string, string> LoadConfigFile()
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    string[] candidates = ["cc-scan-config.json", "../cc-scan-config.json", "../../cc-scan-config.json"];
    foreach (var candidate in candidates)
    {
        var resolved = Path.GetFullPath(candidate);
        if (!File.Exists(resolved)) continue;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(resolved));
            var section = doc.RootElement;
            if (section.TryGetProperty("dotnet", out var dotnetSection))
                section = dotnetSection;
            foreach (var prop in section.EnumerateObject())
            {
                result[prop.Name] = prop.Value.ToString();
            }
            Console.WriteLine($"[cc-scan-dotnet] loaded config from {resolved}");
        }
        catch
        {
            // ignore malformed config
        }
        break;
    }
    return result;
}
