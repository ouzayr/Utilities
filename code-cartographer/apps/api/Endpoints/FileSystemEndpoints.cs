namespace CodeCartographer.Api.Endpoints;

public static class FileSystemEndpoints
{
    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/fs").WithTags("filesystem");

        g.MapGet("/browse", (string? path) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path))
                {
                    var drives = DriveInfo.GetDrives()
                        .Where(d => d.IsReady)
                        .Select(d => new FsEntry(
                            d.RootDirectory.FullName.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                            d.RootDirectory.FullName,
                            "drive",
                            null))
                        .ToList();
                    return Results.Ok(new BrowseResponse(null, drives));
                }

                var dir = new DirectoryInfo(path);
                if (!dir.Exists)
                    return Results.NotFound(new { error = $"Directory not found: {path}" });

                var entries = new List<FsEntry>();
                foreach (var sub in dir.EnumerateDirectories())
                {
                    try
                    {
                        entries.Add(new FsEntry(
                            sub.Name,
                            sub.FullName,
                            "directory",
                            null));
                    }
                    catch (UnauthorizedAccessException)
                    {
                        // skip inaccessible directories
                    }
                }

                var isGitRepo = Directory.Exists(Path.Combine(dir.FullName, ".git"));
                var hasAngularJson = File.Exists(Path.Combine(dir.FullName, "angular.json"));
                var hasSln = dir.GetFiles("*.sln").Length > 0;
                var hasCsproj = dir.GetFiles("*.csproj").Length > 0;
                var hasPackageJson = File.Exists(Path.Combine(dir.FullName, "package.json"));

                var hints = new FolderHints(isGitRepo, hasAngularJson, hasSln, hasCsproj, hasPackageJson);

                return Results.Ok(new BrowseResponse(dir.FullName, entries, hints));
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Json(new { error = "Access denied" }, statusCode: 403);
            }
            catch (Exception ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 500);
            }
        });
    }
}

public sealed record FsEntry(string Name, string Path, string Type, string? Side);
public sealed record FolderHints(bool IsGitRepo, bool HasAngularJson, bool HasSln, bool HasCsproj, bool HasPackageJson);
public sealed record BrowseResponse(string? CurrentPath, List<FsEntry> Entries, FolderHints? Hints = null);
