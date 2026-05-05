using CardForge.Application.DTOs.Tenant;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface ITenantService
{
    Task<List<TenantDto>> GetAllAsync(CancellationToken ct = default);
    Task<TenantDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken ct = default);
    Task<TenantDto> UpdateAsync(Guid id, UpdateTenantRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<TenantDto> UpdatePolicyAsync(Guid id, UpdateTenantPolicyRequest request, CancellationToken ct = default);
}

public class TenantService : ITenantService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<TenantService> _logger;

    public TenantService(IAppDbContext db, ICurrentTenant currentTenant, ILogger<TenantService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public async Task<List<TenantDto>> GetAllAsync(CancellationToken ct = default)
    {
        AssertSuperAdmin();
        var tenants = await _db.Tenants.OrderBy(t => t.Name).ToListAsync(ct);
        return tenants.Select(MapDto).ToList();
    }

    public async Task<TenantDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        AssertSuperAdmin();
        var tenant = await _db.Tenants.FindAsync([id], ct)
            ?? throw new NotFoundException("Tenant", id);
        return MapDto(tenant);
    }

    public async Task<TenantDto> CreateAsync(CreateTenantRequest request, CancellationToken ct = default)
    {
        AssertSuperAdmin();

        if (await _db.Tenants.AnyAsync(t => t.Slug == request.Slug, ct))
            throw new ConflictException($"Slug '{request.Slug}' is already in use.");

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Slug = request.Slug,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Tenant '{Name}' created by SuperAdmin", tenant.Name);
        return MapDto(tenant);
    }

    public async Task<TenantDto> UpdateAsync(Guid id, UpdateTenantRequest request, CancellationToken ct = default)
    {
        AssertSuperAdmin();

        var tenant = await _db.Tenants.FindAsync([id], ct)
            ?? throw new NotFoundException("Tenant", id);

        tenant.Name = request.Name;
        tenant.IsActive = request.IsActive;
        tenant.WhiteLabelEnabled = request.WhiteLabelEnabled;

        await _db.SaveChangesAsync(ct);
        return MapDto(tenant);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        AssertSuperAdmin();

        var tenant = await _db.Tenants.FindAsync([id], ct)
            ?? throw new NotFoundException("Tenant", id);

        _db.Tenants.Remove(tenant);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Tenant {TenantId} deleted by SuperAdmin", id);
    }

    public async Task<TenantDto> UpdatePolicyAsync(Guid id, UpdateTenantPolicyRequest request, CancellationToken ct = default)
    {
        AssertSuperAdmin();

        var tenant = await _db.Tenants.FindAsync([id], ct)
            ?? throw new NotFoundException("Tenant", id);

        tenant.TemplateCreationPolicy = request.TemplateCreationPolicy;
        await _db.SaveChangesAsync(ct);
        return MapDto(tenant);
    }

    private void AssertSuperAdmin()
    {
        if (!_currentTenant.IsSuperAdmin)
            throw new ForbiddenException("Only SuperAdmins can manage tenants.");
    }

    private static TenantDto MapDto(Tenant t) =>
        new(t.Id, t.Name, t.Slug, t.IsActive, t.TemplateCreationPolicy, t.WhiteLabelEnabled, t.CreatedAt);
}
