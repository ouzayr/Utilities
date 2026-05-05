using CardForge.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CardForge.Application.Interfaces;

public interface IAppDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<AppUser> Users { get; }
    DbSet<Template> Templates { get; }
    DbSet<Card> Cards { get; }
    DbSet<Subscription> Subscriptions { get; }
    DbSet<BillingDetails> BillingDetails { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
