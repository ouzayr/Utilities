using CardForge.Domain.Enums;

namespace CardForge.Application.DTOs.Auth;

public record MeResponse(
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    string? JobTitle,
    string? Phone,
    UserRole Role,
    Guid? TenantId,
    string? TenantName,
    string? TenantSlug,
    TemplateCreationPolicy? TemplateCreationPolicy,
    SubscriptionTier? ActiveTier
);
