using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Db;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Repo> Repos => Set<Repo>();
    public DbSet<Scan> Scans => Set<Scan>();
    public DbSet<Node> Nodes => Set<Node>();
    public DbSet<Edge> Edges => Set<Edge>();
    public DbSet<Finding> Findings => Set<Finding>();
    public DbSet<Coverage> Coverage => Set<Coverage>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Repo>().HasKey(x => x.Id);
        b.Entity<Scan>().HasKey(x => x.Id);
        b.Entity<Scan>().HasIndex(x => x.StartedAt);
        b.Entity<Node>().HasKey(x => new { x.ScanId, x.NodeId });
        b.Entity<Node>().HasIndex(x => new { x.ScanId, x.Kind });
        b.Entity<Node>().HasIndex(x => new { x.ScanId, x.Project });
        b.Entity<Edge>().HasKey(x => new { x.ScanId, x.EdgeId });
        b.Entity<Edge>().HasIndex(x => new { x.ScanId, x.SourceId });
        b.Entity<Edge>().HasIndex(x => new { x.ScanId, x.TargetId });
        b.Entity<Edge>().HasIndex(x => new { x.ScanId, x.Kind });
        b.Entity<Finding>().HasKey(x => new { x.ScanId, x.FindingId });
        b.Entity<Finding>().HasIndex(x => new { x.ScanId, x.Severity });
        b.Entity<Finding>().HasIndex(x => new { x.ScanId, x.Category });
        b.Entity<Coverage>().HasKey(x => new { x.ScanId, x.FilePath, x.Line });
        b.Entity<Bookmark>().HasKey(x => x.Id);

        b.Entity<Scan>().Property(x => x.RepoIds).HasColumnType("uuid[]");
        b.Entity<Scan>().Property(x => x.Summary).HasColumnType("jsonb");
        b.Entity<Node>().Property(x => x.Meta).HasColumnType("jsonb");
        b.Entity<Node>().Property(x => x.Metrics).HasColumnType("jsonb");
        b.Entity<Edge>().Property(x => x.Meta).HasColumnType("jsonb");
        b.Entity<Bookmark>().Property(x => x.Config).HasColumnType("jsonb");
    }
}
