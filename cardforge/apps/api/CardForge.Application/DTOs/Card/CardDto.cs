namespace CardForge.Application.DTOs.Card;

public record CardDto(
    Guid Id,
    Guid TenantId,
    Guid UserId,
    Guid? TemplateId,
    string Name,
    string FabricJson,
    string FieldValues,
    bool IsPublished,
    DateTimeOffset? PublishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record CreateCardRequest(string Name, Guid? TemplateId, string FabricJson, string FieldValues);

public record UpdateCardRequest(string Name, string FabricJson, string FieldValues);
