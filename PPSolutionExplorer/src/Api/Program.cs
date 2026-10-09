using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using PPSolutionExplorer.Ai;
using PPSolutionExplorer.Ai.Services;
using PPSolutionExplorer.Api.AiJobs;
using PPSolutionExplorer.Api.Endpoints;
using PPSolutionExplorer.Api.Infrastructure;
using PPSolutionExplorer.Persistence;
using PPSolutionExplorer.Persistence.Stores;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

var maxUpload = builder.Configuration.GetValue<long?>("Upload:MaxBytes") ?? 200L * 1024 * 1024;
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = maxUpload);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = maxUpload);

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddDbContext<ExplorerDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Explorer")
        ?? throw new InvalidOperationException("ConnectionStrings:Explorer is not configured.")));
builder.Services.AddScoped<GraphStore>();
builder.Services.AddScoped<AnnotationStore>();
builder.Services.AddScoped<AiStore>();
builder.Services.AddScoped<IAiOutputStore>(sp => sp.GetRequiredService<AiStore>());

builder.Services.AddExplorerAi(builder.Configuration);
builder.Services.AddSingleton<AiJobQueue>();
builder.Services.AddHostedService<AiJobWorker>();

builder.Services.AddExceptionHandler<ErrorHandling>();
builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ExplorerDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers.XContentTypeOptions = "nosniff";
    headers.XFrameOptions = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers.ContentSecurityPolicy =
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";
    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles();

var api = app.MapGroup("/api");
api.MapGet("/health", () => Results.Ok(new { status = "ok" }));
api.MapImportEndpoints();
api.MapGraphEndpoints();
api.MapAnnotationEndpoints();
api.MapDocsEndpoints();
api.MapAiEndpoints();

// Angular client-side routes.
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
