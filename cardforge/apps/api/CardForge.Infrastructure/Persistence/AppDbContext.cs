using CardForge.Application.Interfaces;
using CardForge.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CardForge.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ICurrentTenant _currentTenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentTenant currentTenant)
        : base(options)
    {
        _currentTenant = currentTenant;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Template> Templates => Set<Template>();
    public DbSet<Card> Cards => Set<Card>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<BillingDetails> BillingDetails => Set<BillingDetails>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(e =>
        {
            e.HasKey(t => t.Id);
            e.HasIndex(t => t.Slug).IsUnique();
            e.Property(t => t.Name).HasMaxLength(200).IsRequired();
            e.Property(t => t.Slug).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<AppUser>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
            e.Property(u => u.LastName).HasMaxLength(100).IsRequired();
            e.Property(u => u.JobTitle).HasMaxLength(200);
            e.Property(u => u.Phone).HasMaxLength(50);
            e.HasOne(u => u.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasQueryFilter(u =>
                _currentTenant.IsSuperAdmin || u.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Template>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).HasMaxLength(200).IsRequired();
            e.Property(t => t.FabricJson).HasColumnType("nvarchar(max)");
            e.Property(t => t.Placeholders).HasColumnType("nvarchar(max)");
            e.HasOne(t => t.Tenant)
                .WithMany()
                .HasForeignKey(t => t.TenantId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired(false);
            e.HasOne(t => t.CreatedBy)
                .WithMany()
                .HasForeignKey(t => t.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasQueryFilter(t =>
                _currentTenant.IsSuperAdmin
                || t.IsGlobal
                || t.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Card>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Name).HasMaxLength(200).IsRequired();
            e.Property(c => c.FabricJson).HasColumnType("nvarchar(max)");
            e.Property(c => c.FieldValues).HasColumnType("nvarchar(max)");
            e.HasOne(c => c.Tenant)
                .WithMany()
                .HasForeignKey(c => c.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(c => c.User)
                .WithMany(u => u.Cards)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.Template)
                .WithMany(t => t.Cards)
                .HasForeignKey(c => c.TemplateId)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);

            e.HasQueryFilter(c =>
                _currentTenant.IsSuperAdmin || c.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Subscription>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Status).HasMaxLength(50).IsRequired();
            e.HasOne(s => s.Tenant)
                .WithMany(t => t.Subscriptions)
                .HasForeignKey(s => s.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasQueryFilter(s =>
                _currentTenant.IsSuperAdmin || s.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<BillingDetails>(e =>
        {
            e.HasKey(b => b.Id);
            e.HasIndex(b => b.SubscriptionId).IsUnique();
            e.Property(b => b.Currency).HasMaxLength(10).IsRequired();
            e.HasOne(b => b.Subscription)
                .WithOne(s => s.BillingDetails)
                .HasForeignKey<BillingDetails>(b => b.SubscriptionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
