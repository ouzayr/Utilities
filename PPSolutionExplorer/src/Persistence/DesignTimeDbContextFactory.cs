using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PPSolutionExplorer.Persistence;

/// <summary>Used by <c>dotnet ef</c> only. Connection string from PPSE_CONNECTION or a local default.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ExplorerDbContext>
{
    public ExplorerDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("PPSE_CONNECTION")
            ?? "Host=127.0.0.1;Port=5432;Database=ppse;Username=ppse;Password=ppse";
        var options = new DbContextOptionsBuilder<ExplorerDbContext>().UseNpgsql(connection).Options;
        return new ExplorerDbContext(options);
    }
}
