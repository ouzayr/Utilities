using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai.Chunking;
using PPSolutionExplorer.Ai.Llm;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Ai.Services;

public sealed class AiStepFailedException(string message) : Exception(message);

/// <summary>
/// Hierarchical (map-reduce) flow summary: leaf scopes are summarised first and their summaries replace
/// their contents in the parent, so any flow fits the context window.
/// </summary>
public sealed class FlowSummaryService(AiRunner runner, ILlmClient llm, IOptions<AiOptions> options)
{
    public const string ScopePrompt = "scope-summary";
    public const string CombinePrompt = "combine-summaries";
    public const string FlowPrompt = "flow-summary";

    public async Task<AiOutputRecord> SummariseAsync(ComponentGraph graph, string flowId, Guid importId, IProgress<(int Done, int Total)>? progress, CancellationToken ct)
    {
        var flow = graph.Find(flowId) ?? throw new KeyNotFoundException(flowId);
        var redactor = FlowContext.RedactorFor(graph, options.Value);
        var chunker = new Chunker(llm);
        var total = graph.Descendants(flowId).Count(n => n.Type.IsContainer()) + 1;
        var done = 0;

        var scopeBudget = await runner.InputBudgetAsync(ScopePrompt, ct);
        var blocks = await ChildBlocksAsync(flowId);

        var flowBudget = await runner.InputBudgetAsync(FlowPrompt, ct);
        var chunks = await chunker.PackAsync(blocks, flowBudget, ct);
        string content;
        if (chunks.Count == 1)
        {
            content = chunks[0];
        }
        else
        {
            var partials = new List<string>();
            for (var i = 0; i < chunks.Count; i++)
            {
                partials.Add($"- part {i + 1} of {chunks.Count}: " + await SummaryTextAsync(ScopePrompt, flow, chunks[i], i + 1, chunks.Count));
            }

            content = string.Join('\n', partials);
        }

        var result = await runner.RunStructuredAsync(FlowPrompt, new Dictionary<string, string>
        {
            ["flowName"] = redactor.Redact(flow.Name),
            ["content"] = StepRenderer.Fence(content),
        }, importId, flowId, AiKinds.FlowSummary, ct);

        progress?.Report((total, total));
        return result;

        async Task<List<string>> ChildBlocksAsync(string parentId)
        {
            var blocks = new List<string>();
            foreach (var child in graph.Children(parentId).Where(c => c.Type.IsFlowStep()))
            {
                string? childSummary = null;
                if (child.Type.IsContainer())
                {
                    childSummary = await SummariseContainerAsync(child);
                }

                blocks.Add(StepRenderer.Render(graph, child, redactor, childSummary));
            }

            return blocks;
        }

        async Task<string> SummariseContainerAsync(GraphNode container)
        {
            var blocks = await ChildBlocksAsync(container.Id);
            string summary;
            if (blocks.Count == 0)
            {
                summary = "(empty)";
            }
            else
            {
                var chunks = await chunker.PackAsync(blocks, scopeBudget, ct);
                var partials = new List<string>();
                for (var i = 0; i < chunks.Count; i++)
                {
                    partials.Add(await SummaryTextAsync(ScopePrompt, container, chunks[i], i + 1, chunks.Count));
                }

                summary = partials.Count == 1 ? partials[0] : await CombineAsync(container, partials);
            }

            progress?.Report((++done, total));
            return summary;
        }

        async Task<string> CombineAsync(GraphNode container, List<string> partials)
        {
            var combineBudget = await runner.InputBudgetAsync(CombinePrompt, ct);
            var blocks = partials.Select((p, i) => $"- part {i + 1}: {p}\n").ToList();
            var chunks = await chunker.PackAsync(blocks, combineBudget, ct);
            if (chunks.Count == 1)
            {
                return await SummaryTextAsync(CombinePrompt, container, chunks[0], 1, 1);
            }

            var next = new List<string>();
            for (var i = 0; i < chunks.Count; i++)
            {
                next.Add(await SummaryTextAsync(CombinePrompt, container, chunks[i], i + 1, chunks.Count));
            }

            return await CombineAsync(container, next);
        }

        async Task<string> SummaryTextAsync(string prompt, GraphNode scope, string chunk, int part, int parts)
        {
            var record = await runner.RunStructuredAsync(prompt, new Dictionary<string, string>
            {
                ["scopeName"] = redactor.Redact(scope.Name),
                ["scopeType"] = scope.SubType is null || scope.SubType == scope.Type.ToString() ? scope.Type.ToString() : $"{scope.Type}/{scope.SubType}",
                ["part"] = part.ToString(),
                ["parts"] = parts.ToString(),
                ["content"] = StepRenderer.Fence(chunk),
            }, importId, scope.Id, AiKinds.ScopeSummary, ct);

            if (!record.IsSuccess || record.Content is null)
            {
                throw new AiStepFailedException($"Summary of '{scope.Name}' failed: {record.Error}");
            }

            return JsonNode.Parse(record.Content)?["summary"]?.GetValue<string>() ?? "";
        }
    }
}
