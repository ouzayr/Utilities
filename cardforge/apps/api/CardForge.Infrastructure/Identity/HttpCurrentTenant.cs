using CardForge.Application.Interfaces;
using CardForge.Domain.Enums;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace CardForge.Infrastructure.Identity;

public class HttpCurrentTenant : ICurrentTenant
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpCurrentTenant(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? TenantId
    {
        get
        {
            var claim = User?.FindFirstValue("tenantId");
            return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public Guid? UserId
    {
        get
        {
            var claim = User?.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? User?.FindFirstValue("sub");
            return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public UserRole? Role
    {
        get
        {
            var claim = User?.FindFirstValue("role");
            return claim is not null && Enum.TryParse<UserRole>(claim, out var role) ? role : null;
        }
    }

    public bool IsSuperAdmin => Role == UserRole.SuperAdmin;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;
}
