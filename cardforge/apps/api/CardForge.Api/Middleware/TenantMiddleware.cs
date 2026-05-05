using Serilog.Context;
using System.Security.Claims;

namespace CardForge.Api.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated == true)
        {
            var tenantId = user.FindFirstValue("tenantId") ?? "platform";
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? user.FindFirstValue("sub") ?? "unknown";

            using (LogContext.PushProperty("TenantId", tenantId))
            using (LogContext.PushProperty("UserId", userId))
            {
                await _next(context);
                return;
            }
        }

        await _next(context);
    }
}
