using CodeCartographer.Api.Db;
using CodeCartographer.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- offline guard ---
var offline = string.Equals(Environment.GetEnvironmentVariable("CC_OFFLINE") ?? "true", "true", StringComparison.OrdinalIgnoreCase);
if (offline)
{
    AppDomain.CurrentDomain.SetData("CC_OFFLINE", true);
}

var conn = Environment.GetEnvironmentVariable("CC_DB_CONNECTION")
    ?? "Host=localhost;Port=15432;Database=codecartographer;Username=cc;Password=cc";
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:4200", "http://localhost:8080")
    .AllowAnyHeader()
    .AllowAnyMethod()));
builder.Services.AddSingleton<CodeCartographer.Api.CrossLink.CrossLinker>();
builder.Services.AddSingleton<CodeCartographer.Api.Reporting.ReportRenderer>();
builder.Services.AddSingleton<CodeCartographer.Api.Diff.DiffEngine>();
builder.Services.AddSingleton<CodeCartographer.Api.Flow.FlowEngine>();

var app = builder.Build();

// Ensure schema exists. We use EnsureCreated for simplicity; for production
// rollouts add a real migrations history later.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();

GraphEndpoints.Map(app);
ScanEndpoints.Map(app);
RepoEndpoints.Map(app);
FlowEndpoints.Map(app);
ImpactEndpoints.Map(app);
DiffEndpoints.Map(app);
ReportEndpoints.Map(app);
DashboardEndpoints.Map(app);
ImportExportEndpoints.Map(app);

app.MapGet("/", () => Results.Json(new { name = "code-cartographer-api", version = "0.1.0", offline }));

app.Run();
