using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Persistence.Entities;

namespace PPSolutionExplorer.Persistence.Stores;

public sealed record AuditDto(long Id, DateTimeOffset At, string Action, string Target, string? Details, string Actor);

/// <summary>Append-only audit log. Entries are never updated or deleted by the app.</summary>
public sealed class AuditStore(ExplorerDbContext db)
{
    public async Task WriteAsync(string action, string target, string? details, CancellationToken ct)
    {
        db.Audit.Add(new AuditEntity
        {
            At = DateTimeOffset.UtcNow,
            Action = action,
            Target = target,
            Details = details is { Length: > 2000 } ? details[..2000] : details,
            Actor = Environment.UserName,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AuditDto>> RecentAsync(string? target, int take, CancellationToken ct) =>
        await db.Audit.AsNoTracking()
            .Where(a => target == null || a.Target == target)
            .OrderByDescending(a => a.Id)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(a => new AuditDto(a.Id, a.At, a.Action, a.Target, a.Details, a.Actor))
            .ToListAsync(ct);
}
