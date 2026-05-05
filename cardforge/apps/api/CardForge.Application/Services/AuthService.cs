using CardForge.Application.DTOs.Auth;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<AuthResponse> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task<MeResponse> GetMeAsync(CancellationToken ct = default);
}

public class AuthService : IAuthService
{
    private readonly IAppDbContext _db;
    private readonly IJwtService _jwt;
    private readonly ICurrentTenant _currentTenant;
    private readonly ISubscriptionService _subscriptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IAppDbContext db,
        IJwtService jwt,
        ICurrentTenant currentTenant,
        ISubscriptionService subscriptions,
        ILogger<AuthService> logger)
    {
        _db = db;
        _jwt = jwt;
        _currentTenant = currentTenant;
        _subscriptions = subscriptions;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        if (await _db.Tenants.AnyAsync(t => t.Slug == request.TenantSlug, ct))
            throw new ConflictException($"A tenant with slug '{request.TenantSlug}' already exists.");

        if (await _db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new ConflictException($"A user with email '{request.Email}' already exists.");

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = request.TenantName,
            Slug = request.TenantSlug,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = request.Email.ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.ClientAdmin,
            FirstName = request.FirstName,
            LastName = request.LastName,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Tier = SubscriptionTier.Starter,
            Status = "Active",
            StartsAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var billing = new BillingDetails
        {
            Id = Guid.NewGuid(),
            SubscriptionId = subscription.Id,
            AmountCents = 0,
            Currency = "USD",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Tenants.Add(tenant);
        _db.Users.Add(user);
        _db.Subscriptions.Add(subscription);
        _db.BillingDetails.Add(billing);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Registered tenant {TenantSlug} with admin user {Email}", tenant.Slug, user.Email);

        return BuildAuthResponse(user, tenant);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant(), ct);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for {Email}", request.Email);
            throw new ForbiddenException("Invalid email or password.");
        }

        if (!user.IsActive)
            throw new ForbiddenException("Your account has been deactivated.");

        _logger.LogInformation("User {Email} logged in", user.Email);
        return BuildAuthResponse(user, user.Tenant);
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var userId = _currentTenant.UserId
            ?? throw new ForbiddenException("Invalid token.");

        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new NotFoundException("User", userId);

        return BuildAuthResponse(user, user.Tenant);
    }

    public async Task<MeResponse> GetMeAsync(CancellationToken ct = default)
    {
        var userId = _currentTenant.UserId
            ?? throw new ForbiddenException("Not authenticated.");

        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new NotFoundException("User", userId);

        SubscriptionTier? tier = null;
        if (user.TenantId.HasValue)
            tier = await _subscriptions.GetActiveTierAsync(user.TenantId.Value, ct);

        return new MeResponse(
            user.Id, user.Email, user.FirstName, user.LastName,
            user.JobTitle, user.Phone, user.Role, user.TenantId,
            user.Tenant?.Name, user.Tenant?.Slug,
            user.Tenant?.TemplateCreationPolicy, tier);
    }

    private AuthResponse BuildAuthResponse(AppUser user, Tenant? tenant)
    {
        var token = _jwt.GenerateToken(user);
        var refresh = _jwt.GenerateRefreshToken();
        return new AuthResponse(token, refresh, user.Id, user.Email,
            user.FirstName, user.LastName, user.Role,
            user.TenantId, tenant?.TemplateCreationPolicy);
    }
}
