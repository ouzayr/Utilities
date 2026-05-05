using CardForge.Application.DTOs.Auth;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync(CancellationToken ct = default);
    Task<UserDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> UpdateRoleAsync(Guid id, UpdateUserRoleRequest request, CancellationToken ct = default);
}

public class UserService : IUserService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ISubscriptionService _subscriptions;
    private readonly ILogger<UserService> _logger;

    public UserService(
        IAppDbContext db,
        ICurrentTenant currentTenant,
        ISubscriptionService subscriptions,
        ILogger<UserService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _subscriptions = subscriptions;
        _logger = logger;
    }

    public async Task<List<UserDto>> GetAllAsync(CancellationToken ct = default)
    {
        var users = await _db.Users
            .OrderBy(u => u.LastName)
            .ToListAsync(ct);

        return users.Select(MapDto).ToList();
    }

    public async Task<UserDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new NotFoundException("User", id);
        return MapDto(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        AssertClientAdminOrAbove();

        var tenantId = _currentTenant.TenantId
            ?? throw new ForbiddenException("No tenant context.");

        if (await _db.Users.AnyAsync(u => u.Email == request.Email.ToLowerInvariant(), ct))
            throw new ConflictException($"A user with email '{request.Email}' already exists.");

        var tier = await _subscriptions.GetActiveTierAsync(tenantId, ct);
        var userCount = await _db.Users.CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);
        var maxUsers = TierLimits.MaxUsers(tier);

        if (maxUsers != int.MaxValue && userCount >= maxUsers)
            throw new TierLimitException(
                $"Your {tier} plan allows a maximum of {maxUsers} users. Upgrade to add more.",
                tier,
                tier + 1);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = request.Email.ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            FirstName = request.FirstName,
            LastName = request.LastName,
            JobTitle = request.JobTitle,
            Phone = request.Phone,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("User {Email} created in tenant {TenantId}", user.Email, tenantId);
        return MapDto(user);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        AssertClientAdminOrAbove();

        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new NotFoundException("User", id);

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.JobTitle = request.JobTitle;
        user.Phone = request.Phone;
        user.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);
        return MapDto(user);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        AssertClientAdminOrAbove();

        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new NotFoundException("User", id);

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("User {UserId} deleted", id);
    }

    public async Task<UserDto> UpdateRoleAsync(Guid id, UpdateUserRoleRequest request, CancellationToken ct = default)
    {
        AssertClientAdminOrAbove();

        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new NotFoundException("User", id);

        if (request.Role == UserRole.SuperAdmin && !_currentTenant.IsSuperAdmin)
            throw new ForbiddenException("Only a SuperAdmin can assign the SuperAdmin role.");

        user.Role = request.Role;
        await _db.SaveChangesAsync(ct);
        return MapDto(user);
    }

    private void AssertClientAdminOrAbove()
    {
        var role = _currentTenant.Role ?? throw new ForbiddenException();
        if (role > UserRole.ClientAdmin && !_currentTenant.IsSuperAdmin)
            throw new ForbiddenException("Only a Client Admin or above can manage users.");
    }

    private static UserDto MapDto(AppUser u) =>
        new(u.Id, u.TenantId, u.Email, u.FirstName, u.LastName,
            u.JobTitle, u.Phone, u.Role, u.IsActive, u.CreatedAt);
}

public static class TierLimits
{
    public static int MaxUsers(Domain.Enums.SubscriptionTier tier) => tier switch
    {
        Domain.Enums.SubscriptionTier.Starter => 10,
        Domain.Enums.SubscriptionTier.Professional => 50,
        Domain.Enums.SubscriptionTier.Enterprise => int.MaxValue,
        _ => 10
    };

    public static int MaxTemplates(Domain.Enums.SubscriptionTier tier) => tier switch
    {
        Domain.Enums.SubscriptionTier.Starter => 3,
        Domain.Enums.SubscriptionTier.Professional => 20,
        Domain.Enums.SubscriptionTier.Enterprise => int.MaxValue,
        _ => 3
    };

    public static bool CanExportPdf(Domain.Enums.SubscriptionTier tier) =>
        tier >= Domain.Enums.SubscriptionTier.Professional;

    public static bool HasWhiteLabel(Domain.Enums.SubscriptionTier tier) =>
        tier == Domain.Enums.SubscriptionTier.Enterprise;
}
