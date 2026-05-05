using CardForge.Domain.Enums;

namespace CardForge.Application.Interfaces;

public interface ICurrentTenant
{
    Guid? TenantId { get; }
    Guid? UserId { get; }
    UserRole? Role { get; }
    bool IsSuperAdmin { get; }
    bool IsAuthenticated { get; }
}
