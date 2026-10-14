using PPSolutionExplorer.Persistence.Stores;

namespace PPSolutionExplorer.Api.Endpoints;

public sealed record TagRequest(string NodeId, string Tag);

public sealed record NoteRequest(string NodeId, string Text);

public sealed record NoteUpdate(string Text);

/// <summary>Tags and notes live in our store only. Nothing is written back to solutions.</summary>
public static class AnnotationEndpoints
{
    public static void MapAnnotationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/tags", (string? nodeId, AnnotationStore store, CancellationToken ct) => store.TagsAsync(nodeId, ct));

        api.MapPost("/tags", async (TagRequest request, AnnotationStore store, AuditStore audit, CancellationToken ct) =>
        {
            var tag = await store.AddTagAsync(request.NodeId, request.Tag, "user", ct);
            await audit.WriteAsync("tag.add", tag.NodeId, tag.Tag, ct);
            return Results.Ok(tag);
        });

        api.MapDelete("/tags/{id:long}", async (long id, AnnotationStore store, AuditStore audit, CancellationToken ct) =>
        {
            var tag = await store.GetTagAsync(id, ct);
            if (tag is null || !await store.RemoveTagAsync(id, ct))
            {
                return Results.NotFound();
            }

            await audit.WriteAsync("tag.remove", tag.NodeId, tag.Tag, ct);
            return Results.NoContent();
        });

        api.MapGet("/notes", (string nodeId, AnnotationStore store, CancellationToken ct) => store.NotesAsync(nodeId, ct));

        api.MapPost("/notes", async (NoteRequest request, AnnotationStore store, AuditStore audit, CancellationToken ct) =>
        {
            var note = await store.AddNoteAsync(request.NodeId, request.Text, ct);
            await audit.WriteAsync("note.add", note.NodeId, $"#{note.Id}", ct);
            return Results.Ok(note);
        });

        api.MapPut("/notes/{id:long}", async (long id, NoteUpdate request, AnnotationStore store, AuditStore audit, CancellationToken ct) =>
        {
            if (await store.UpdateNoteAsync(id, request.Text, ct) is not { } note)
            {
                return Results.NotFound();
            }

            await audit.WriteAsync("note.update", note.NodeId, $"#{note.Id}", ct);
            return Results.Ok(note);
        });

        api.MapDelete("/notes/{id:long}", async (long id, AnnotationStore store, AuditStore audit, CancellationToken ct) =>
        {
            var note = await store.GetNoteAsync(id, ct);
            if (note is null || !await store.RemoveNoteAsync(id, ct))
            {
                return Results.NotFound();
            }

            await audit.WriteAsync("note.delete", note.NodeId, $"#{note.Id}", ct);
            return Results.NoContent();
        });

        api.MapGet("/audit", (string? target, int? take, AuditStore audit, CancellationToken ct) => audit.RecentAsync(target, take ?? 200, ct));
    }
}
