using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai;
using PPSolutionExplorer.Ai.Llm;
using PPSolutionExplorer.Ai.Prompts;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Api.AiJobs;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

public sealed record AiJobCreate(string Kind, Guid ImportId, string NodeId);

public sealed record NlSearchRequest(string Question, Guid? ImportId);

public sealed record AcceptTagRequest(string Tag);

public static class AiEndpoints
{
    public static void MapAiEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/ai");

        group.MapGet("/status", async (IOptions<AiOptions> options, ILlmClient llm, IPromptLibrary prompts, CancellationToken ct) =>
        {
            var o = options.Value;
            var health = o.Enabled ? await llm.HealthAsync(ct) : new LlmHealth(false, null, "AI is disabled.");
            return Results.Ok(new
            {
                o.Enabled,
                o.BaseUrl,
                health.Reachable,
                health.Model,
                health.Error,
                o.ContextSize,
                o.ParallelSlots,
                SlotContext = o.SlotContext,
                Prompts = prompts.All.Select(p => new { p.Name, p.Version, p.Description }),
            });
        });

        group.MapPost("/jobs", async (AiJobCreate request, IOptions<AiOptions> options, AiStore store, GraphStore graph, AiJobQueue queue, CancellationToken ct) =>
        {
            if (!options.Value.Enabled)
            {
                throw new AiDisabledException();
            }

            if (!AiJobWorker.Kinds.Contains(request.Kind))
            {
                return Results.BadRequest(new { title = $"Kind must be one of: {string.Join(", ", AiJobWorker.Kinds)}." });
            }

            if (await graph.GetNodeAsync(request.ImportId, request.NodeId.Split('#')[0], ct) is null)
            {
                return Results.NotFound();
            }

            var job = await store.CreateJobAsync(request.Kind, request.ImportId, request.NodeId, ct);
            await queue.EnqueueAsync(new AiJobRequest(job.Id, request.Kind, request.ImportId, request.NodeId), ct);
            return Results.Accepted($"/api/ai/jobs/{job.Id}", job);
        });

        group.MapGet("/jobs", (AiStore store, CancellationToken ct) => store.RecentJobsAsync(50, ct));

        group.MapGet("/jobs/{id:guid}", async (Guid id, AiStore store, CancellationToken ct) =>
            await store.GetJobAsync(id, ct) is { } job ? Results.Ok(job) : Results.NotFound());

        group.MapGet("/outputs", (string nodeId, AiStore store, CancellationToken ct) => store.LatestForNodeAsync(nodeId, ct));

        // Streams a step description as server-sent events. The full text is stored with provenance when complete.
        group.MapGet("/describe/stream", async (HttpContext http, Guid importId, string nodeId, IOptions<AiOptions> options,
            GraphStore graphs, StepAiService ai, CancellationToken ct) =>
        {
            if (!options.Value.Enabled)
            {
                throw new AiDisabledException();
            }

            var flowId = GraphStore.FlowIdOf(nodeId) ?? throw new ArgumentException("Only flow steps can be described.");
            var graph = await graphs.LoadFlowGraphAsync(importId, flowId, ct) ?? throw new KeyNotFoundException(flowId);
            var node = graph.Find(nodeId) ?? throw new KeyNotFoundException(nodeId);

            http.Response.ContentType = "text/event-stream";
            http.Response.Headers.CacheControl = "no-cache";
            await foreach (var token in ai.DescribeStreamAsync(graph, node, importId, ct))
            {
                await http.Response.WriteAsync($"data: {JsonSerializer.Serialize(token)}\n\n", ct);
                await http.Response.Body.FlushAsync(ct);
            }

            await http.Response.WriteAsync("event: done\ndata: {}\n\n", ct);
        });

        group.MapPost("/search", async (NlSearchRequest request, IOptions<AiOptions> options, GraphStore graphs, StepAiService ai, CancellationToken ct) =>
        {
            if (!options.Value.Enabled)
            {
                throw new AiDisabledException();
            }

            if (string.IsNullOrWhiteSpace(request.Question))
            {
                return Results.BadRequest(new { title = "Question is required." });
            }

            var facets = await graphs.GetFacetsAsync(request.ImportId, ct);
            var result = await ai.ToSearchQueryAsync(request.Question, facets, request.ImportId, ct);

            // The validated query is shown to the user and run like any manual query.
            var results = result.Output.IsSuccess ? await graphs.SearchAsync(result.Query, ct) : [];
            return Results.Ok(new { result.Query, result.Dropped, ai = result.Output, results });
        });

        // A user explicitly accepts one suggested tag. Suggestions are never applied automatically.
        group.MapPost("/outputs/{id:guid}/accept-tag", async (Guid id, AcceptTagRequest request, AiStore store, AnnotationStore annotations, CancellationToken ct) =>
        {
            var output = await store.GetOutputAsync(id, ct);
            if (output is null || output.Kind != AiKinds.TagSuggestions || !output.IsSuccess || output.Content is null)
            {
                return Results.NotFound();
            }

            var suggested = JsonNode.Parse(output.Content)?["tags"]?.AsArray()
                .Select(t => t?["tag"]?.GetValue<string>())
                .Contains(AnnotationStore.NormaliseTag(request.Tag)) ?? false;
            if (!suggested)
            {
                return Results.BadRequest(new { title = "Tag was not part of this suggestion." });
            }

            return Results.Ok(await annotations.AddTagAsync(output.NodeId, request.Tag, "ai-accepted", ct));
        });
    }
}
