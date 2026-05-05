namespace CardForge.Domain.Entities;

public class Card
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public Guid? TemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FabricJson { get; set; } = "{}";
    public string FieldValues { get; set; } = "{}";
    public bool IsPublished { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Tenant? Tenant { get; set; }
    public AppUser? User { get; set; }
    public Template? Template { get; set; }
}
