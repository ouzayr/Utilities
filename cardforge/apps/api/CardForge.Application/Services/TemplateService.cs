using CardForge.Application.DTOs.Template;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface ITemplateService
{
    Task<List<TemplateDto>> GetAllAsync(CancellationToken ct = default);
    Task<TemplateDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<TemplateDto> CreateAsync(CreateTemplateRequest request, CancellationToken ct = default);
    Task<TemplateDto> UpdateAsync(Guid id, UpdateTemplateRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<TemplateDto> PublishAsync(Guid id, CancellationToken ct = default);
}

public class TemplateService : ITemplateService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<TemplateService> _logger;

    public TemplateService(IAppDbContext db, ICurrentTenant currentTenant, ILogger<TemplateService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public async Task<List<TemplateDto>> GetAllAsync(CancellationToken ct = default)
    {
        var templates = await _db.Templates
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return templates.Select(MapDto).ToList();
    }

    public async Task<TemplateDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _db.Templates.FindAsync([id], ct)
            ?? throw new NotFoundException("Template", id);

        return MapDto(template);
    }

    public async Task<TemplateDto> CreateAsync(CreateTemplateRequest request, CancellationToken ct = default)
    {
        await AssertCanManageTemplatesAsync(ct);

        var template = new Template
        {
            Id = Guid.NewGuid(),
            TenantId = _currentTenant.TenantId,
            CreatedByUserId = _currentTenant.UserId!.Value,
            Name = request.Name,
            FabricJson = request.FabricJson,
            Placeholders = request.Placeholders,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Templates.Add(template);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Template '{Name}' created by user {UserId}", template.Name, template.CreatedByUserId);
        return MapDto(template);
    }

    public async Task<TemplateDto> UpdateAsync(Guid id, UpdateTemplateRequest request, CancellationToken ct = default)
    {
        await AssertCanManageTemplatesAsync(ct);

        var template = await _db.Templates.FindAsync([id], ct)
            ?? throw new NotFoundException("Template", id);

        template.Name = request.Name;
        template.FabricJson = request.FabricJson;
        template.Placeholders = request.Placeholders;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return MapDto(template);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await AssertCanManageTemplatesAsync(ct);

        var template = await _db.Templates.FindAsync([id], ct)
            ?? throw new NotFoundException("Template", id);

        _db.Templates.Remove(template);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Template {TemplateId} deleted", id);
    }

    public async Task<TemplateDto> PublishAsync(Guid id, CancellationToken ct = default)
    {
        await AssertCanManageTemplatesAsync(ct);

        var template = await _db.Templates.FindAsync([id], ct)
            ?? throw new NotFoundException("Template", id);

        template.IsPublished = true;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapDto(template);
    }

    private async Task AssertCanManageTemplatesAsync(CancellationToken ct)
    {
        var role = _currentTenant.Role ?? throw new ForbiddenException();

        if (_currentTenant.IsSuperAdmin) return;

        var tenantId = _currentTenant.TenantId
            ?? throw new ForbiddenException("No tenant context.");

        var tenant = await _db.Tenants.FindAsync([tenantId], ct)
            ?? throw new NotFoundException("Tenant", tenantId);

        var allowed = tenant.TemplateCreationPolicy switch
        {
            TemplateCreationPolicy.PlatformAdminOnly => false,
            TemplateCreationPolicy.ClientAdminOnly => role <= UserRole.ClientAdmin,
            TemplateCreationPolicy.TemplateManagerOrAbove => role <= UserRole.TemplateManager,
            TemplateCreationPolicy.AnyUser => true,
            _ => false
        };

        if (!allowed)
            throw new ForbiddenException("Template creation is not allowed for your role under the current tenant policy.");
    }

    private static TemplateDto MapDto(Template t) =>
        new(t.Id, t.TenantId, t.CreatedByUserId, t.Name, t.FabricJson,
            t.Placeholders, t.IsPublished, t.IsGlobal, t.CreatedAt, t.UpdatedAt);
}
