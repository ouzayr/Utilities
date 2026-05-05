using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class ExportEndpoints
{
    public static void MapExportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/export").WithTags("Export").RequireAuthorization();

        group.MapGet("/cards/{id:guid}/vcf", async (Guid id, IVcfService vcf, CancellationToken ct) =>
        {
            var (content, fileName) = await vcf.GenerateForCardAsync(id, ct);
            return Results.File(
                System.Text.Encoding.UTF8.GetBytes(content),
                "text/vcard",
                fileName);
        });
    }
}
