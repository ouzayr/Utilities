using CardForge.Domain.Enums;

namespace CardForge.Application.DTOs.Tenant;

public record TenantDto(
    Guid Id,
    string Name,
    string Slug,
    bool IsActive,
    TemplateCreationPolicy TemplateCreationPolicy,
    bool WhiteLabelEnabled,
    DateTimeOffset CreatedAt
);

public record CreateTenantRequest(string Name, string Slug);

public record UpdateTenantRequest(string Name, bool IsActive, bool WhiteLabelEnabled);

public record UpdateTenantPolicyRequest(TemplateCreationPolicy TemplateCreationPolicy);
