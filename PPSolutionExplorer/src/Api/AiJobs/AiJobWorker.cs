using Microsoft.Extensions.Options;
using PPSolutionExplorer.Ai;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Core.Quality;
using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.AiJobs;

/// <summary>
/// Processes queued AI jobs with one worker per llama-server slot. Failures are recorded on the job
/// (and as <c>ai_status = failed</c> outputs); they never affect parsing, search or tracing.
/// </summary>
public sealed class AiJobWorker(AiJobQueue queue, IServiceScopeFactory scopes, IOptions<AiOptions> options, ILogger<AiJobWorker> logger) : BackgroundService
{
    public static readonly string[] Kinds = [AiKinds.FlowSummary, AiKinds.ActionDescription, AiKinds.TagSuggestions, AiKinds.QualityExplanation];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using (var scope = scopes.CreateScope())
        {
            var failed = await scope.ServiceProvider.GetRequiredService<AiStore>().FailInterruptedJobsAsync(stoppingToken);
            if (failed > 0)
            {
                logger.LogInformation("Marked {Count} interrupted AI jobs as failed.", failed);
            }
        }

        if (!options.Value.Enabled)
        {
            return;
        }

        var workers = Enumerable.Range(0, Math.Max(1, options.Value.ParallelSlots)).Select(_ => RunWorkerAsync(stoppingToken));
        await Task.WhenAll(workers);
    }

    private async Task RunWorkerAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            using var scope = scopes.CreateScope();
            var store = scope.ServiceProvider.GetRequiredService<AiStore>();
            try
            {
                await store.UpdateJobAsync(job.JobId, "running", 0, 1, null, null, stoppingToken);
                var output = await RunAsync(scope.ServiceProvider, store, job, stoppingToken);
                await store.UpdateJobAsync(job.JobId, output.IsSuccess ? "succeeded" : "failed", 1, 1, output.Error, output.Id, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "AI job {Job} ({Kind}) failed.", job.JobId, job.Kind);
                await store.UpdateJobAsync(job.JobId, "failed", 0, 1, ex.Message, null, CancellationToken.None);
            }
        }
    }

    private static async Task<AiOutputRecord> RunAsync(IServiceProvider services, AiStore store, AiJobRequest job, CancellationToken ct)
    {
        var graphs = services.GetRequiredService<GraphStore>();
        var flowId = GraphStore.FlowIdOf(job.NodeId.Split('#')[0]) ?? job.NodeId;
        var graph = await graphs.LoadFlowGraphAsync(job.ImportId, flowId, ct)
            ?? throw new KeyNotFoundException($"Flow '{flowId}' not found in import {job.ImportId}.");

        switch (job.Kind)
        {
            case AiKinds.FlowSummary:
                var progress = new Progress<(int Done, int Total)>(p =>
                    _ = store.UpdateJobAsync(job.JobId, "running", p.Done, p.Total, null, null, CancellationToken.None));
                return await services.GetRequiredService<FlowSummaryService>().SummariseAsync(graph, flowId, job.ImportId, progress, ct);

            case AiKinds.ActionDescription:
                return await services.GetRequiredService<StepAiService>().DescribeAsync(graph, Node(graph, job.NodeId), job.ImportId, ct);

            case AiKinds.TagSuggestions:
                return await services.GetRequiredService<StepAiService>().SuggestTagsAsync(graph, Node(graph, job.NodeId), job.ImportId, ct);

            case AiKinds.QualityExplanation:
                // NodeId is "<nodeId>#<ruleId>": the finding is recomputed by the rule engine, not taken from the client.
                var parts = job.NodeId.Split('#', 2);
                var finding = QualityRules.Evaluate(graph, flowId).FirstOrDefault(f => f.NodeId == parts[0] && f.RuleId == parts.ElementAtOrDefault(1))
                    ?? throw new KeyNotFoundException($"No finding {parts.ElementAtOrDefault(1)} on '{parts[0]}'.");
                return await services.GetRequiredService<StepAiService>().ExplainFindingAsync(graph, finding, job.ImportId, ct);

            default:
                throw new ArgumentException($"Unknown AI job kind '{job.Kind}'.");
        }
    }

    private static Core.Model.GraphNode Node(Core.Graph.ComponentGraph graph, string id) =>
        graph.Find(id) ?? throw new KeyNotFoundException($"Node '{id}' not found.");
}
