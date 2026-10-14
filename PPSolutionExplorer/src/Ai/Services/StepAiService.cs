using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai.Chunking;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Core.Search;

namespace PPSolutionExplorer.Ai.Services;

public sealed record NlSearchResult(SearchQuery Query, IReadOnlyList<string> Dropped, AiOutputRecord Output);

/// <summary>Per-step description, tag suggestions, natural-language search and quality explanations.</summary>
public sealed class StepAiService(AiRunner runner, IOptions<AiOptions> options)
{
    public const string DescriptionPrompt = "action-description";
    public const string DescriptionStreamPrompt = "action-description-stream";
    public const string TagPrompt = "tag-suggestions";
    public const string SearchPrompt = "nl-search";
    public const string QualityPrompt = "quality-explanation";

    private readonly AiOptions _options = options.Value;

    public Task<AiOutputRecord> DescribeAsync(ComponentGraph graph, GraphNode step, Guid importId, CancellationToken ct) =>
        runner.RunStructuredAsync(DescriptionPrompt, StepValues(graph, step), importId, step.Id, AiKinds.ActionDescription, ct);

    public IAsyncEnumerable<string> DescribeStreamAsync(ComponentGraph graph, GraphNode step, Guid importId, CancellationToken ct) =>
        runner.StreamAsync(DescriptionStreamPrompt, StepValues(graph, step), importId, step.Id, AiKinds.ActionDescription, ct);

    /// <summary>Suggestions only. The user must accept each tag; nothing is applied automatically.</summary>
    public Task<AiOutputRecord> SuggestTagsAsync(ComponentGraph graph, GraphNode node, Guid importId, CancellationToken ct)
    {
        var redactor = FlowContext.RedactorFor(graph, _options);
        var steps = node.Type == NodeType.Flow
            ? graph.Descendants(node.Id).Where(n => n.Type.IsFlowStep()).Take(60).ToList()
            : [node];
        var content = string.Concat(steps.Select(s => StepRenderer.Render(graph, s, redactor)));
        var vocabulary = _options.TagVocabulary.Select(t => t.ToLowerInvariant()).ToHashSet();

        return runner.RunStructuredAsync(TagPrompt, new Dictionary<string, string>
        {
            ["vocabulary"] = string.Join(", ", vocabulary),
            ["nodeName"] = redactor.Redact(node.Name),
            ["content"] = StepRenderer.Fence(content),
        }, importId, node.Id, AiKinds.TagSuggestions, ct, postProcess: output =>
        {
            // Normalise and re-check vocabulary membership; the model's own claim is not trusted.
            var tags = new JsonArray();
            foreach (var item in output["tags"]?.AsArray() ?? [])
            {
                var tag = item?["tag"]?.GetValue<string>()?.Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(tag) || tag.Length > 64)
                {
                    continue;
                }

                tags.Add(new JsonObject
                {
                    ["tag"] = tag,
                    ["inVocabulary"] = vocabulary.Contains(tag),
                    ["reason"] = item?["reason"]?.GetValue<string>() ?? "",
                });
            }

            return new JsonObject { ["tags"] = tags };
        });
    }

    /// <summary>
    /// Turns a question into a <see cref="SearchQuery"/>. The output is schema-constrained, then every value
    /// is checked against known facets. It is never executed as SQL or code.
    /// </summary>
    public async Task<NlSearchResult> ToSearchQueryAsync(string question, SearchFacets facets, Guid? importId, CancellationToken ct)
    {
        static string List(IReadOnlyList<string> values) => values.Count == 0 ? "(none)" : string.Join(", ", values.Take(200));

        var output = await runner.RunStructuredAsync(SearchPrompt, new Dictionary<string, string>
        {
            ["nodeTypes"] = string.Join(", ", Enum.GetNames<NodeType>()),
            ["subTypes"] = List(facets.SubTypes),
            ["connectors"] = List(facets.Connectors),
            ["tables"] = List(facets.Tables),
            ["tags"] = List(facets.Tags),
            ["question"] = StepRenderer.Fence(question.Length > 1000 ? question[..1000] : question),
        }, importId, "search", AiKinds.NlSearch, ct);

        if (!output.IsSuccess || output.Content is null)
        {
            return new NlSearchResult(new SearchQuery { ImportId = importId }, [], output);
        }

        var json = JsonNode.Parse(output.Content)!;
        static IReadOnlyList<string> Strings(JsonNode? node) =>
            node?.AsArray().Select(n => n?.GetValue<string>()).OfType<string>().ToList() ?? [];

        var types = Strings(json["nodeTypes"]).Select(t => Enum.TryParse<NodeType>(t, true, out var v) ? v : (NodeType?)null).OfType<NodeType>().ToList();
        var query = new SearchQuery
        {
            ImportId = importId,
            Text = json["text"]?.GetValue<string>(),
            NodeTypes = types,
            SubTypes = Strings(json["subTypes"]),
            Connectors = Strings(json["connectors"]),
            Tables = Strings(json["tables"]),
            Tags = Strings(json["tags"]),
            HasUnresolved = json["hasUnresolved"]?.GetValue<string>() switch { "yes" => true, "no" => false, _ => null },
        };

        var (sanitised, dropped) = facets.Sanitise(query);
        return new NlSearchResult(sanitised, dropped, output);
    }

    /// <summary>The rule engine found the issue; the model only explains it and suggests a fix.</summary>
    public Task<AiOutputRecord> ExplainFindingAsync(ComponentGraph graph, QualityFinding finding, Guid importId, CancellationToken ct)
    {
        var redactor = FlowContext.RedactorFor(graph, _options);
        var node = graph.Find(finding.NodeId) ?? throw new KeyNotFoundException(finding.NodeId);
        var findingText = JsonSerializer.Serialize(new { finding.RuleId, Severity = finding.Severity.ToString(), finding.Message, finding.Evidence });

        return runner.RunStructuredAsync(QualityPrompt, new Dictionary<string, string>
        {
            ["finding"] = redactor.Redact(findingText),
            ["content"] = StepRenderer.Fence(StepRenderer.Render(graph, node, redactor)),
        }, importId, $"{finding.NodeId}#{finding.RuleId}", AiKinds.QualityExplanation, ct);
    }

    private Dictionary<string, string> StepValues(ComponentGraph graph, GraphNode step)
    {
        var redactor = FlowContext.RedactorFor(graph, _options);
        return new Dictionary<string, string>
        {
            ["stepName"] = redactor.Redact(step.Name),
            ["content"] = StepRenderer.Fence(StepRenderer.Render(graph, step, redactor)),
        };
    }
}
