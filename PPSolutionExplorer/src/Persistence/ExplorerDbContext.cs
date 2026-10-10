using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PPSolutionExplorer.Persistence.Entities;

namespace PPSolutionExplorer.Persistence;

public sealed class ExplorerDbContext(DbContextOptions<ExplorerDbContext> options) : DbContext(options)
{
    public DbSet<ImportEntity> Imports => Set<ImportEntity>();
    public DbSet<NodeEntity> Nodes => Set<NodeEntity>();
    public DbSet<EdgeEntity> Edges => Set<EdgeEntity>();
    public DbSet<UnresolvedEntity> Unresolved => Set<UnresolvedEntity>();
    public DbSet<TagEntity> Tags => Set<TagEntity>();
    public DbSet<NoteEntity> Notes => Set<NoteEntity>();
    public DbSet<AiOutputEntity> AiOutputs => Set<AiOutputEntity>();
    public DbSet<AiJobEntity> AiJobs => Set<AiJobEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ImportEntity>(e =>
        {
            e.ToTable("imports");
            e.HasKey(x => x.Id);
            e.Property(x => x.Warnings).HasColumnType("jsonb").HasConversion(JsonConverter<List<string>>(), JsonComparer<List<string>>());
            e.HasIndex(x => x.Sha256);
        });

        modelBuilder.Entity<NodeEntity>(e =>
        {
            e.ToTable("nodes");
            e.HasKey(x => new { x.ImportId, x.Id });
            e.Property(x => x.Properties).HasColumnType("jsonb").HasConversion(JsonConverter<Dictionary<string, string>>(), JsonComparer<Dictionary<string, string>>());
            e.HasIndex(x => new { x.ImportId, x.ParentId });
            e.HasIndex(x => new { x.ImportId, x.Type });
            e.HasIndex(x => x.Id);
            e.HasOne<ImportEntity>().WithMany().HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EdgeEntity>(e =>
        {
            e.ToTable("edges");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ImportId, x.SourceId });
            e.HasIndex(x => new { x.ImportId, x.TargetId });
            e.HasOne<ImportEntity>().WithMany().HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UnresolvedEntity>(e =>
        {
            e.ToTable("unresolved_references");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ImportId, x.NodeId });
            e.HasOne<ImportEntity>().WithMany().HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TagEntity>(e =>
        {
            e.ToTable("tags");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.NodeId, x.Tag }).IsUnique();
            e.HasIndex(x => x.Tag);
        });

        modelBuilder.Entity<NoteEntity>(e =>
        {
            e.ToTable("notes");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.NodeId);
        });

        modelBuilder.Entity<AiOutputEntity>(e =>
        {
            e.ToTable("ai_outputs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.CacheKey);
            e.HasIndex(x => new { x.NodeId, x.Kind });
        });

        modelBuilder.Entity<AiJobEntity>(e =>
        {
            e.ToTable("ai_jobs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Status);
        });

        // snake_case names for raw SQL readability.
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static ValueConverter<T, string> JsonConverter<T>() where T : new() => new(
        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
        v => JsonSerializer.Deserialize<T>(v, (JsonSerializerOptions?)null) ?? new T());

    private static ValueComparer<T> JsonComparer<T>() => new(
        (a, b) => JsonSerializer.Serialize(a, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(b, (JsonSerializerOptions?)null),
        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null).GetHashCode(),
        v => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!);

    private static string ToSnakeCase(string name) =>
        string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? "_" + char.ToLowerInvariant(c) : char.ToLowerInvariant(c).ToString()));
}
