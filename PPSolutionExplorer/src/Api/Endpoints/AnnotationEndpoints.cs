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

        api.MapPost("/tags", async (TagRequest request, AnnotationStore store, CancellationToken ct) =>
            Results.Ok(await store.AddTagAsync(request.NodeId, request.Tag, "user", ct)));

        api.MapDelete("/tags/{id:long}", async (long id, AnnotationStore store, CancellationToken ct) =>
            await store.RemoveTagAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        api.MapGet("/notes", (string nodeId, AnnotationStore store, CancellationToken ct) => store.NotesAsync(nodeId, ct));

        api.MapPost("/notes", async (NoteRequest request, AnnotationStore store, CancellationToken ct) =>
            Results.Ok(await store.AddNoteAsync(request.NodeId, request.Text, ct)));

        api.MapPut("/notes/{id:long}", async (long id, NoteUpdate request, AnnotationStore store, CancellationToken ct) =>
            await store.UpdateNoteAsync(id, request.Text, ct) is { } note ? Results.Ok(note) : Results.NotFound());

        api.MapDelete("/notes/{id:long}", async (long id, AnnotationStore store, CancellationToken ct) =>
            await store.RemoveNoteAsync(id, ct) ? Results.NoContent() : Results.NotFound());
    }
}
