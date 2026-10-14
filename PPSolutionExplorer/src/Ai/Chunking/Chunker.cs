using PPSolutionExplorer.Ai.Llm;

namespace PPSolutionExplorer.Ai.Chunking;

/// <summary>
/// Packs rendered step blocks into chunks that fit a token budget, measured with the server tokenizer.
/// Blocks are never split: a chunk boundary is always between two steps (scope boundaries come for free
/// because a container is one block holding its child summary).
/// </summary>
public sealed class Chunker(ILlmClient llm)
{
    public async Task<IReadOnlyList<string>> PackAsync(IReadOnlyList<string> blocks, int tokenBudget, CancellationToken ct)
    {
        var chunks = new List<string>();
        var current = new List<string>();
        var currentTokens = 0;

        foreach (var block in blocks)
        {
            var tokens = await llm.CountTokensAsync(block, ct);
            if (tokens > tokenBudget)
            {
                // A single oversized step: truncate the block itself; it still goes in its own chunk.
                Flush();
                chunks.Add(await TruncateAsync(block, tokenBudget, ct));
                continue;
            }

            if (currentTokens + tokens > tokenBudget && current.Count > 0)
            {
                Flush();
            }

            current.Add(block);
            currentTokens += tokens;
        }

        Flush();
        return chunks;

        void Flush()
        {
            if (current.Count > 0)
            {
                chunks.Add(string.Concat(current));
                current.Clear();
                currentTokens = 0;
            }
        }
    }

    private async Task<string> TruncateAsync(string block, int tokenBudget, CancellationToken ct)
    {
        var text = block;
        while (text.Length > 200 && await llm.CountTokensAsync(text, ct) > tokenBudget)
        {
            text = text[..(text.Length * 3 / 4)];
        }

        return text + " …(truncated to fit context)\n";
    }
}
