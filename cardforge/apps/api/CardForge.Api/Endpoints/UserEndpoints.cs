using CardForge.Application.DTOs.Auth;
using CardForge.Application.Services;

namespace CardForge.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users").RequireAuthorization();

        group.MapGet("/", async (IUserService users, CancellationToken ct) =>
            Results.Ok(await users.GetAllAsync(ct)));

        group.MapGet("/{id:guid}", async (Guid id, IUserService users, CancellationToken ct) =>
            Results.Ok(await users.GetByIdAsync(id, ct)));

        group.MapPost("/", async (CreateUserRequest request, IUserService users, CancellationToken ct) =>
        {
            var result = await users.CreateAsync(request, ct);
            return Results.Created($"/api/users/{result.Id}", result);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateUserRequest request, IUserService users, CancellationToken ct) =>
            Results.Ok(await users.UpdateAsync(id, request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, IUserService users, CancellationToken ct) =>
        {
            await users.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        group.MapPut("/{id:guid}/role", async (Guid id, UpdateUserRoleRequest request, IUserService users, CancellationToken ct) =>
            Results.Ok(await users.UpdateRoleAsync(id, request, ct)));
    }
}
