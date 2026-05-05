namespace CardForge.Domain.Enums;

public enum TemplateCreationPolicy
{
    PlatformAdminOnly = 0,
    ClientAdminOnly = 1,
    TemplateManagerOrAbove = 2,
    AnyUser = 3
}
