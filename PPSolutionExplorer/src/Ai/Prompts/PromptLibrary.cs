using System.Text.Json;
using Microsoft.Extensions.Options;

namespace PPSolutionExplorer.Ai.Prompts;

public interface IPromptLibrary
{
    PromptTemplate Get(string name);

    IReadOnlyCollection<PromptTemplate> All { get; }
}

/// <summary>Loads <c>*.prompt.json</c> files from the configured prompts folder at startup.</summary>
public sealed class PromptLibrary : IPromptLibrary
{
    private readonly Dictionary<string, PromptTemplate> _prompts = new(StringComparer.Ordinal);

    public PromptLibrary(IOptions<AiOptions> options)
        : this(ResolvePath(options.Value.PromptsPath))
    {
    }

    public PromptLibrary(string folder)
    {
        if (!Directory.Exists(folder))
        {
            throw new DirectoryNotFoundException($"Prompts folder '{folder}' not found.");
        }

        foreach (var file in Directory.EnumerateFiles(folder, "*.prompt.json"))
        {
            var prompt = JsonSerializer.Deserialize<PromptTemplate>(File.ReadAllText(file))
                ?? throw new InvalidDataException($"Prompt file '{file}' is empty.");
            if (!_prompts.TryAdd(prompt.Name, prompt))
            {
                throw new InvalidDataException($"Duplicate prompt name '{prompt.Name}'.");
            }
        }
    }

    public IReadOnlyCollection<PromptTemplate> All => _prompts.Values;

    public PromptTemplate Get(string name) =>
        _prompts.TryGetValue(name, out var prompt) ? prompt : throw new KeyNotFoundException($"Prompt '{name}' not found.");

    private static string ResolvePath(string path)
    {
        if (Path.IsPathRooted(path))
        {
            return path;
        }

        // Published app: prompts copied next to the binaries. Dev: walk up to the repo root.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, path);
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        return Path.Combine(AppContext.BaseDirectory, path);
    }
}
