using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace CardForge.Application.Services;

public interface IVcfService
{
    Task<(string Content, string FileName)> GenerateForCardAsync(Guid cardId, CancellationToken ct = default);
}

public class VcfService : IVcfService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly IVcfGenerator _generator;
    private readonly ILogger<VcfService> _logger;

    public VcfService(IAppDbContext db, ICurrentTenant currentTenant, IVcfGenerator generator, ILogger<VcfService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _generator = generator;
        _logger = logger;
    }

    public async Task<(string Content, string FileName)> GenerateForCardAsync(Guid cardId, CancellationToken ct = default)
    {
        var card = await _db.Cards
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Id == cardId, ct)
            ?? throw new NotFoundException("Card", cardId);

        if (!_currentTenant.IsSuperAdmin && card.TenantId != _currentTenant.TenantId)
            throw new ForbiddenException();

        var fields = JsonSerializer.Deserialize<Dictionary<string, string>>(card.FieldValues)
                     ?? new Dictionary<string, string>();

        fields.TryGetValue("firstName", out var firstName);
        fields.TryGetValue("lastName", out var lastName);
        fields.TryGetValue("jobTitle", out var jobTitle);
        fields.TryGetValue("phone", out var phone);
        fields.TryGetValue("email", out var email);
        fields.TryGetValue("company", out var company);
        fields.TryGetValue("website", out var website);

        var contact = new VcfContact(
            firstName ?? card.User?.FirstName ?? string.Empty,
            lastName ?? card.User?.LastName ?? string.Empty,
            jobTitle ?? card.User?.JobTitle,
            phone ?? card.User?.Phone,
            email ?? card.User?.Email,
            company,
            website);

        var vcf = _generator.Generate(contact);
        var fileName = $"{contact.FirstName}_{contact.LastName}.vcf"
            .Replace(" ", "_")
            .Replace("/", "_");

        _logger.LogInformation("VCF generated for card {CardId}", cardId);
        return (vcf, fileName);
    }
}
