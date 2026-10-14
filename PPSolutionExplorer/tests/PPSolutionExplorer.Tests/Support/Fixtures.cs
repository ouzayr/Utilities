using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Text;
using PPSolutionExplorer.Core.Graph;

namespace PPSolutionExplorer.Tests.Support;

public static class Fixtures
{
    public static string Root([CallerFilePath] string caller = "")
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(caller)!);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "fixtures")))
        {
            dir = dir.Parent;
        }

        return Path.Combine(dir?.FullName ?? throw new DirectoryNotFoundException("tests/fixtures"), "fixtures");
    }

    public static string Read(string relative) => File.ReadAllText(Path.Combine(Root(), relative));

    /// <summary>Zips a fixture folder in memory, the way a solution export is laid out.</summary>
    public static MemoryStream ZipFolder(string relative)
    {
        var folder = Path.Combine(Root(), relative);
        var memory = new MemoryStream();
        using (var zip = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var file in Directory.EnumerateFiles(folder, "*", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
            {
                var entryName = Path.GetRelativePath(folder, file).Replace('\\', '/');
                var entry = zip.CreateEntry(entryName);
                using var stream = entry.Open();
                stream.Write(File.ReadAllBytes(file));
            }
        }

        memory.Position = 0;
        return memory;
    }

    /// <summary>Canonical, sorted text form of a graph for golden-file comparison.</summary>
    public static string Canonical(ComponentGraph graph)
    {
        var builder = new StringBuilder();
        builder.AppendLine("# nodes");
        foreach (var node in graph.Nodes.OrderBy(n => n.Id, StringComparer.Ordinal))
        {
            builder.Append($"{node.Id} | {node.Type} | {node.Name} | parent={node.ParentId} | branch={node.Branch} | sub={node.SubType}");
            if (node.IsPlaceholder)
            {
                builder.Append(" | placeholder");
            }

            builder.AppendLine();
        }

        builder.AppendLine("# edges");
        foreach (var edge in graph.Edges.OrderBy(e => e.SourceId, StringComparer.Ordinal).ThenBy(e => e.TargetId, StringComparer.Ordinal).ThenBy(e => e.Type))
        {
            builder.AppendLine($"{edge.SourceId} -{edge.Type}{(edge.Status == 0 ? "" : "[" + edge.Status + "]")}-> {edge.TargetId}");
        }

        builder.AppendLine("# unresolved");
        foreach (var u in graph.Unresolved.OrderBy(u => u.NodeId, StringComparer.Ordinal).ThenBy(u => u.RawExpression, StringComparer.Ordinal))
        {
            builder.AppendLine($"{u.NodeId} | {u.Reason} | {u.RawExpression}");
        }

        builder.AppendLine("# warnings");
        foreach (var warning in graph.Warnings.Order(StringComparer.Ordinal))
        {
            builder.AppendLine(warning);
        }

        return builder.ToString().ReplaceLineEndings("\n");
    }

    /// <summary>Compares with a golden file. Set UPDATE_GOLDEN=1 to (re)write it.</summary>
    public static void AssertGolden(string name, string actual)
    {
        var path = Path.Combine(Root(), "golden", name);
        if (Environment.GetEnvironmentVariable("UPDATE_GOLDEN") == "1" || !File.Exists(path))
        {
            File.WriteAllText(path, actual);
            if (Environment.GetEnvironmentVariable("UPDATE_GOLDEN") != "1")
            {
                Assert.Fail($"Golden file '{name}' did not exist and was created. Review it and re-run.");
            }

            return;
        }

        Assert.Equal(File.ReadAllText(path).ReplaceLineEndings("\n"), actual);
    }
}
