using CardForge.Domain.Enums;

namespace CardForge.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public TemplateCreationPolicy TemplateCreationPolicy { get; set; } = TemplateCreationPolicy.ClientAdminOnly;
    public bool WhiteLabelEnabled { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
