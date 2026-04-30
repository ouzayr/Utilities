using System.CommandLine;
using System.Text.Json;
using CodeCartographer.ScannerDotnet;
using Microsoft.Build.Locator;

if (!MSBuildLocator.IsRegistered)
{
    MSBuildLocator.RegisterDefaults();
}

var rootOption = new Option<DirectoryInfo>("--root", "Path to the .NET solution root or a folder containing .csproj/.sln files") { IsRequired = true };
var outOption = new Option<FileInfo>("--out", () => new FileInfo("graph.json"), "Output graph.json path");
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
    var rootDir = ctx.ParseResult.GetValueForOption(rootOption)!;
    var outFile = ctx.ParseResult.GetValueForOption(outOption)!;
    var project = ctx.ParseResult.GetValueForOption(projectOption);
    var apiBase = ctx.ParseResult.GetValueForOption(apiBaseOption);
    var scanId = ctx.ParseResult.GetValueForOption(scanIdOption);
    var finalize = ctx.ParseResult.GetValueForOption(finalizeOption);

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
