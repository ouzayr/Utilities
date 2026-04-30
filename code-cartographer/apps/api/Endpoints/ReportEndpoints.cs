using CodeCartographer.Api.Db;
using CodeCartographer.Api.Reporting;

namespace CodeCartographer.Api.Endpoints;

public static class ReportEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/reports").WithTags("reports");

        g.MapGet("/{scanId:guid}/export", async (Guid scanId, string? format, AppDbContext db, ReportRenderer renderer) =>
        {
            var fmt = (format ?? "md").ToLowerInvariant();
            var (bytes, contentType, fileName) = await renderer.RenderAsync(db, scanId, fmt);
            return Results.File(bytes, contentType, fileName);
        });
    }
}
