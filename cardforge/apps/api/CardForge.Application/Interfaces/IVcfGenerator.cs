namespace CardForge.Application.Interfaces;

public interface IVcfGenerator
{
    string Generate(VcfContact contact);
}

public record VcfContact(
    string FirstName,
    string LastName,
    string? JobTitle,
    string? Phone,
    string? Email,
    string? Company,
    string? Website
);
