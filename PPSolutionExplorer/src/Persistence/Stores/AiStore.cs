using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Persistence.Entities;

namespace PPSolutionExplorer.Persistence.Stores;

public sealed record AiJobDto(Guid Id, string Kind, Guid? ImportId, string NodeId, string Status, int Progress, int Total,
    string? Error, Guid? OutputId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>AI outputs (with provenance) and background job state.</summary>
public sealed class AiStore(ExplorerDbContext db) : IAiOutputStore
{
    public async Task<AiOutputRecord?> FindSucceededByCacheKeyAsync(string cacheKey, CancellationToken ct) =>
        await db.AiOutputs.AsNoTracking()
            .Where(o => o.CacheKey == cacheKey && o.AiStatus == AiOutputRecord.Succeeded)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => ToRecord(o))
            .FirstOrDefaultAsync(ct);

    public async Task<AiOutputRecord> SaveAsync(AiOutputRecord record, CancellationToken ct)
    {
        db.AiOutputs.Add(new AiOutputEntity
        {
            Id = record.Id,
            ImportId = record.ImportId,
            NodeId = record.NodeId,
            Kind = record.Kind,
            Content = record.Content,
            Model = record.Model,
            PromptName = record.PromptName,
            PromptVersion = record.PromptVersion,
            CacheKey = record.CacheKey,
            AiStatus = record.AiStatus,
            Error = record.Error,
            CreatedAt = record.CreatedAt,
        });
        await db.SaveChangesAsync(ct);
        return record;
    }

    /// <summary>Latest output per kind for a node (successful ones first).</summary>
    public async Task<IReadOnlyList<AiOutputRecord>> LatestForNodeAsync(string nodeId, CancellationToken ct)
    {
        var outputs = await db.AiOutputs.AsNoTracking()
            .Where(o => o.NodeId == nodeId || o.NodeId.StartsWith(nodeId + "#"))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return outputs
            .GroupBy(o => (o.NodeId, o.Kind))
            .Select(g => g.FirstOrDefault(o => o.AiStatus == AiOutputRecord.Succeeded) ?? g.First())
            .Select(ToRecord)
            .ToList();
    }

    public async Task<IReadOnlyDictionary<string, AiOutputRecord>> LatestSucceededAsync(IReadOnlyCollection<string> nodeIds, string kind, CancellationToken ct)
    {
        var ids = nodeIds.ToList();
        var outputs = await db.AiOutputs.AsNoTracking()
            .Where(o => ids.Contains(o.NodeId) && o.Kind == kind && o.AiStatus == AiOutputRecord.Succeeded)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);
        return outputs.GroupBy(o => o.NodeId).ToDictionary(g => g.Key, g => ToRecord(g.First()));
    }

    public async Task<AiOutputRecord?> GetOutputAsync(Guid id, CancellationToken ct) =>
        await db.AiOutputs.AsNoTracking().Where(o => o.Id == id).Select(o => ToRecord(o)).FirstOrDefaultAsync(ct);

    public async Task<AiJobDto> CreateJobAsync(string kind, Guid? importId, string nodeId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var job = new AiJobEntity { Id = Guid.NewGuid(), Kind = kind, ImportId = importId, NodeId = nodeId, Status = "queued", CreatedAt = now, UpdatedAt = now };
        db.AiJobs.Add(job);
        await db.SaveChangesAsync(ct);
        return ToDto(job);
    }

    public async Task<AiJobDto?> GetJobAsync(Guid id, CancellationToken ct) =>
        await db.AiJobs.AsNoTracking().Where(j => j.Id == id).Select(j => ToDto(j)).FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<AiJobDto>> RecentJobsAsync(int take, CancellationToken ct) =>
        await db.AiJobs.AsNoTracking().OrderByDescending(j => j.CreatedAt).Take(take).Select(j => ToDto(j)).ToListAsync(ct);

    public async Task UpdateJobAsync(Guid id, string status, int progress, int total, string? error, Guid? outputId, CancellationToken ct)
    {
        await db.AiJobs.Where(j => j.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(j => j.Status, status)
            .SetProperty(j => j.Progress, progress)
            .SetProperty(j => j.Total, total)
            .SetProperty(j => j.Error, error)
            .SetProperty(j => j.OutputId, outputId)
            .SetProperty(j => j.UpdatedAt, DateTimeOffset.UtcNow), ct);
    }

    /// <summary>Jobs left running by a previous process are marked failed at startup.</summary>
    public async Task<int> FailInterruptedJobsAsync(CancellationToken ct) =>
        await db.AiJobs.Where(j => j.Status == "queued" || j.Status == "running")
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.Status, "failed").SetProperty(j => j.Error, "Interrupted by restart.").SetProperty(j => j.UpdatedAt, DateTimeOffset.UtcNow), ct);

    private static AiOutputRecord ToRecord(AiOutputEntity o) =>
        new(o.Id, o.ImportId, o.NodeId, o.Kind, o.Content, o.Model, o.PromptName, o.PromptVersion, o.CacheKey, o.AiStatus, o.Error, o.CreatedAt);

    private static AiJobDto ToDto(AiJobEntity j) =>
        new(j.Id, j.Kind, j.ImportId, j.NodeId, j.Status, j.Progress, j.Total, j.Error, j.OutputId, j.CreatedAt, j.UpdatedAt);
}
