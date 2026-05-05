using CardForge.Domain.Enums;

namespace CardForge.Domain.Entities;

public class AppUser
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }

    public Tenant? Tenant { get; set; }
    public ICollection<Card> Cards { get; set; } = new List<Card>();
}
