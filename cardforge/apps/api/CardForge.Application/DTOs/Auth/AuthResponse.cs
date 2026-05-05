using CardForge.Domain.Enums;

namespace CardForge.Application.DTOs.Auth;

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    UserRole Role,
    Guid? TenantId,
    TemplateCreationPolicy? TemplateCreationPolicy
);
