using CardForge.Application.DTOs.Card;
using CardForge.Application.Exceptions;
using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using CardForge.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CardForge.Application.Services;

public interface ICardService
{
    Task<List<CardDto>> GetAllAsync(CancellationToken ct = default);
    Task<CardDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<CardDto> CreateAsync(CreateCardRequest request, CancellationToken ct = default);
    Task<CardDto> UpdateAsync(Guid id, UpdateCardRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<CardDto> PublishAsync(Guid id, CancellationToken ct = default);
}

public class CardService : ICardService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ISubscriptionService _subscriptions;
    private readonly ILogger<CardService> _logger;

    public CardService(
        IAppDbContext db,
        ICurrentTenant currentTenant,
        ISubscriptionService subscriptions,
        ILogger<CardService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _subscriptions = subscriptions;
        _logger = logger;
    }

    public async Task<List<CardDto>> GetAllAsync(CancellationToken ct = default)
    {
        var query = _db.Cards.AsQueryable();

        if (!_currentTenant.IsSuperAdmin)
            query = query.Where(c => c.UserId == _currentTenant.UserId);

        var cards = await query.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        return cards.Select(MapDto).ToList();
    }

    public async Task<CardDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var card = await _db.Cards.FindAsync([id], ct)
            ?? throw new NotFoundException("Card", id);

        AssertOwnerOrAdmin(card);
        return MapDto(card);
    }

    public async Task<CardDto> CreateAsync(CreateCardRequest request, CancellationToken ct = default)
    {
        var tenantId = _currentTenant.TenantId
            ?? throw new ForbiddenException("No tenant context.");
        var userId = _currentTenant.UserId!.Value;

        var card = new Card
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            TemplateId = request.TemplateId,
            Name = request.Name,
            FabricJson = request.FabricJson,
            FieldValues = request.FieldValues,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Cards.Add(card);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Card '{Name}' created by user {UserId}", card.Name, userId);
        return MapDto(card);
    }

    public async Task<CardDto> UpdateAsync(Guid id, UpdateCardRequest request, CancellationToken ct = default)
    {
        var card = await _db.Cards.FindAsync([id], ct)
            ?? throw new NotFoundException("Card", id);

        AssertOwnerOrAdmin(card);

        card.Name = request.Name;
        card.FabricJson = request.FabricJson;
        card.FieldValues = request.FieldValues;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return MapDto(card);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var card = await _db.Cards.FindAsync([id], ct)
            ?? throw new NotFoundException("Card", id);

        AssertOwnerOrAdmin(card);
        _db.Cards.Remove(card);
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Card {CardId} deleted", id);
    }

    public async Task<CardDto> PublishAsync(Guid id, CancellationToken ct = default)
    {
        var card = await _db.Cards.FindAsync([id], ct)
            ?? throw new NotFoundException("Card", id);

        AssertOwnerOrAdmin(card);
        card.IsPublished = true;
        card.PublishedAt = DateTimeOffset.UtcNow;
        card.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapDto(card);
    }

    private void AssertOwnerOrAdmin(Card card)
    {
        if (_currentTenant.IsSuperAdmin) return;
        if (card.UserId == _currentTenant.UserId) return;
        var role = _currentTenant.Role ?? throw new ForbiddenException();
        if (role <= UserRole.ClientAdmin) return;
        throw new ForbiddenException("You do not have access to this card.");
    }

    private static CardDto MapDto(Card c) =>
        new(c.Id, c.TenantId, c.UserId, c.TemplateId, c.Name,
            c.FabricJson, c.FieldValues, c.IsPublished, c.PublishedAt, c.CreatedAt, c.UpdatedAt);
}
