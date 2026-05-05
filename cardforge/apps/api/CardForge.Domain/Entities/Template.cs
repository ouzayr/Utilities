namespace CardForge.Domain.Entities;

public class Template
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FabricJson { get; set; } = "{}";
    public string Placeholders { get; set; } = "[]";
    public bool IsPublished { get; set; }
    public bool IsGlobal { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Tenant? Tenant { get; set; }
    public AppUser? CreatedBy { get; set; }
    public ICollection<Card> Cards { get; set; } = new List<Card>();
}
