using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Persistence.Entities;

namespace PPSolutionExplorer.Persistence.Stores;

public sealed record TagDto(long Id, string NodeId, string Tag, string Source, DateTimeOffset CreatedAt);

public sealed record NoteDto(long Id, string NodeId, string Text, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>Tags and notes. Sidecar tables keyed by node ID; customer files are never touched.</summary>
public sealed class AnnotationStore(ExplorerDbContext db)
{
    public const int MaxTagLength = 64;
    public const int MaxNoteLength = 10_000;

    public async Task<IReadOnlyList<TagDto>> TagsAsync(string? nodeId, CancellationToken ct) =>
        await db.Tags.AsNoTracking()
            .Where(t => nodeId == null || t.NodeId == nodeId)
            .OrderBy(t => t.Tag)
            .Select(t => new TagDto(t.Id, t.NodeId, t.Tag, t.Source, t.CreatedAt))
            .ToListAsync(ct);

    public async Task<TagDto> AddTagAsync(string nodeId, string tag, string source, CancellationToken ct)
    {
        tag = NormaliseTag(tag);
        var existing = await db.Tags.FirstOrDefaultAsync(t => t.NodeId == nodeId && t.Tag == tag, ct);
        if (existing is not null)
        {
            return new TagDto(existing.Id, existing.NodeId, existing.Tag, existing.Source, existing.CreatedAt);
        }

        var entity = new TagEntity { NodeId = nodeId, Tag = tag, Source = source, CreatedAt = DateTimeOffset.UtcNow };
        db.Tags.Add(entity);
        await db.SaveChangesAsync(ct);
        return new TagDto(entity.Id, entity.NodeId, entity.Tag, entity.Source, entity.CreatedAt);
    }

    public async Task<bool> RemoveTagAsync(long id, CancellationToken ct) =>
        await db.Tags.Where(t => t.Id == id).ExecuteDeleteAsync(ct) > 0;

    public async Task<IReadOnlyList<NoteDto>> NotesAsync(string nodeId, CancellationToken ct) =>
        await db.Notes.AsNoTracking()
            .Where(n => n.NodeId == nodeId)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new NoteDto(n.Id, n.NodeId, n.Text, n.CreatedAt, n.UpdatedAt))
            .ToListAsync(ct);

    public async Task<NoteDto> AddNoteAsync(string nodeId, string text, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var entity = new NoteEntity { NodeId = nodeId, Text = Limit(text), CreatedAt = now, UpdatedAt = now };
        db.Notes.Add(entity);
        await db.SaveChangesAsync(ct);
        return new NoteDto(entity.Id, entity.NodeId, entity.Text, entity.CreatedAt, entity.UpdatedAt);
    }

    public async Task<NoteDto?> UpdateNoteAsync(long id, string text, CancellationToken ct)
    {
        var entity = await db.Notes.FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null)
        {
            return null;
        }

        entity.Text = Limit(text);
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return new NoteDto(entity.Id, entity.NodeId, entity.Text, entity.CreatedAt, entity.UpdatedAt);
    }

    public async Task<bool> RemoveNoteAsync(long id, CancellationToken ct) =>
        await db.Notes.Where(n => n.Id == id).ExecuteDeleteAsync(ct) > 0;

    public static string NormaliseTag(string tag)
    {
        var trimmed = tag.Trim().ToLowerInvariant();
        if (trimmed.Length == 0 || trimmed.Length > MaxTagLength)
        {
            throw new ArgumentException($"Tag must be 1-{MaxTagLength} characters.", nameof(tag));
        }

        return trimmed;
    }

    private static string Limit(string text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxNoteLength)
        {
            throw new ArgumentException($"Note must be 1-{MaxNoteLength} characters.", nameof(text));
        }

        return text;
    }
}
