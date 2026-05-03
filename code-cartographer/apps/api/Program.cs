using CodeCartographer.Api.Db;
using CodeCartographer.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- configuration ---
var config = builder.Configuration;
var ccSection = config.GetSection("CodeCartographer");

var offline = string.Equals(
    Environment.GetEnvironmentVariable("CC_OFFLINE")
        ?? ccSection["Offline"]
        ?? "true",
    "true",
    StringComparison.OrdinalIgnoreCase);
if (offline)
{
    AppDomain.CurrentDomain.SetData("CC_OFFLINE", true);
}

var conn = Environment.GetEnvironmentVariable("CC_DB_CONNECTION")
    ?? config.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=15432;Database=codecartographer;Username=cc;Password=cc";
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn));

var apiPort = int.TryParse(
    Environment.GetEnvironmentVariable("CC_API_PORT") ?? ccSection["ApiPort"],
    out var p)
    ? p
    : 8080;
var bind = Environment.GetEnvironmentVariable("CC_BIND") ?? ccSection["Bind"] ?? "127.0.0.1";
builder.WebHost.UseUrls($"http://{bind}:{apiPort}");

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(pol => pol
    .WithOrigins("http://localhost:4200", $"http://localhost:{apiPort}")
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
FileSystemEndpoints.Map(app);

app.MapGet("/", () => Results.Json(new { name = "code-cartographer-api", version = "0.1.0", offline }));

app.Run();
