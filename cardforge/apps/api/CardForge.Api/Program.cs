using CardForge.Api.Endpoints;
using CardForge.Api.Middleware;
using CardForge.Application.Interfaces;
using CardForge.Application.Services;
using CardForge.Infrastructure.Billing;
using CardForge.Infrastructure.Identity;
using CardForge.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, config) =>
        config.ReadFrom.Configuration(ctx.Configuration)
              .ReadFrom.Services(services)
              .Enrich.FromLogContext()
              .Enrich.WithMachineName()
              .Enrich.WithThreadId());

    // EF Core + SQL Server
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.MigrationsAssembly("CardForge.Infrastructure")));

    builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

    // HttpContext / tenant resolution
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentTenant, HttpCurrentTenant>();

    // Application services
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<ITenantService, TenantService>();
    builder.Services.AddScoped<ITemplateService, TemplateService>();
    builder.Services.AddScoped<ICardService, CardService>();
    builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
    builder.Services.AddScoped<IVcfService, VcfService>();

    // Infrastructure
    builder.Services.AddScoped<IJwtService, JwtService>();
    builder.Services.AddScoped<IPaymentProvider, StubPaymentProvider>();
    builder.Services.AddScoped<IVcfGenerator, VcfGenerator>();

    // JWT authentication
    var jwtSecret = builder.Configuration["JwtSettings:Secret"]!;
    var jwtIssuer = builder.Configuration["JwtSettings:Issuer"]!;
    var jwtAudience = builder.Configuration["JwtSettings:Audience"]!;

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
            };
        });

    builder.Services.AddAuthorization();

    // CORS
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                         ?? ["http://localhost:3000"];

    builder.Services.AddCors(options =>
        options.AddDefaultPolicy(policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials()));

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "CardForge API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new()
        {
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        });
        c.AddSecurityRequirement(new()
        {
            {
                new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } },
                Array.Empty<string>()
            }
        });
    });

    var app = builder.Build();

    // Middleware pipeline — order matters
    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseMiddleware<CorrelationIdMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseSerilogRequestLogging(opts =>
    {
        opts.EnrichDiagnosticContext = (diag, ctx) =>
        {
            diag.Set("ClientIP", ctx.Connection.RemoteIpAddress);
            diag.Set("UserAgent", ctx.Request.Headers.UserAgent.ToString());
        };
    });

    app.UseCors();
    app.UseAuthentication();
    app.UseMiddleware<TenantMiddleware>();
    app.UseAuthorization();

    // Run migrations automatically on startup in Development
    if (app.Environment.IsDevelopment())
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }

    // Health check
    app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", version = "1.0.0" }))
        .WithTags("Health")
        .AllowAnonymous();

    // Register endpoint groups
    app.MapAuthEndpoints();
    app.MapTenantEndpoints();
    app.MapUserEndpoints();
    app.MapTemplateEndpoints();
    app.MapCardEndpoints();
    app.MapSubscriptionEndpoints();
    app.MapExportEndpoints();

    Log.Information("CardForge API starting on {Environment}", app.Environment.EnvironmentName);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "CardForge API failed to start");
}
finally
{
    Log.CloseAndFlush();
}
