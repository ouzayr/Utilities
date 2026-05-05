using CardForge.Application.DTOs.Auth;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", async (RegisterRequest request, IAuthService auth, CancellationToken ct) =>
        {
            var result = await auth.RegisterAsync(request, ct);
            return Results.Ok(result);
        });

        group.MapPost("/login", async (LoginRequest request, IAuthService auth, CancellationToken ct) =>
        {
            var result = await auth.LoginAsync(request, ct);
            return Results.Ok(result);
        });

        group.MapPost("/refresh", async (IAuthService auth, CancellationToken ct) =>
        {
            var result = await auth.RefreshAsync(string.Empty, ct);
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/me", async (IAuthService auth, CancellationToken ct) =>
        {
            var result = await auth.GetMeAsync(ct);
            return Results.Ok(result);
        }).RequireAuthorization();
    }
}
