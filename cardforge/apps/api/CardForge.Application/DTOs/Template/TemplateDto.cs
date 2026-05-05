namespace CardForge.Application.DTOs.Template;

public record TemplateDto(
    Guid Id,
    Guid? TenantId,
    Guid CreatedByUserId,
    string Name,
    string FabricJson,
    string Placeholders,
    bool IsPublished,
    bool IsGlobal,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record CreateTemplateRequest(string Name, string FabricJson, string Placeholders);

public record UpdateTemplateRequest(string Name, string FabricJson, string Placeholders);
