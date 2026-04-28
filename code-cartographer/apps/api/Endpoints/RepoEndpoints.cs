using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Endpoints;

public static class RepoEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/repos").WithTags("repos");

        g.MapGet("/", async (AppDbContext db) =>
        {
            var list = await db.Repos.OrderBy(r => r.Name).ToListAsync();
            return Results.Ok(list);
        });

        g.MapPost("/", async (RepoUpsert req, AppDbContext db) =>
        {
            var repo = new Repo
            {
                Name = req.Name,
                Side = req.Side,
                SourceKind = req.SourceKind,
                Location = req.Location,
                IncludeGlobs = req.IncludeGlobs,
                ExcludeGlobs = req.ExcludeGlobs,
            };
            db.Repos.Add(repo);
            await db.SaveChangesAsync();
            return Results.Ok(repo);
        });

        g.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var r = await db.Repos.FindAsync(id);
            if (r is null) return Results.NotFound();
            db.Repos.Remove(r);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}

public sealed record RepoUpsert(string Name, string Side, string SourceKind, string Location, string? IncludeGlobs, string? ExcludeGlobs);
