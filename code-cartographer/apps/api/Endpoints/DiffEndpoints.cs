using CodeCartographer.Api.Db;
using CodeCartographer.Api.Diff;

namespace CodeCartographer.Api.Endpoints;

public static class DiffEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/diff").WithTags("diff");
        g.MapGet("/{left:guid}/{right:guid}", async (Guid left, Guid right, AppDbContext db, DiffEngine engine) =>
        {
            var d = await engine.DiffAsync(db, left, right);
            return Results.Ok(d);
        });
    }
}
