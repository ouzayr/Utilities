using System.IO.Compression;
using System.Text;

namespace PPSolutionExplorer.Parsers.Solutions;

/// <summary>
/// Reads zip entries into memory with size caps. Nothing is extracted to disk (no path traversal, no zip bombs).
/// </summary>
public sealed class SafeZipReader : IDisposable
{
    public const long MaxEntryBytes = 100L * 1024 * 1024;
    public const long MaxTotalBytes = 1024L * 1024 * 1024;
    public const int MaxEntries = 50_000;

    private readonly ZipArchive _archive;
    private readonly Dictionary<string, ZipArchiveEntry> _entries;
    private long _totalRead;

    public SafeZipReader(Stream stream)
    {
        _archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        if (_archive.Entries.Count > MaxEntries)
        {
            throw new InvalidDataException($"Archive has more than {MaxEntries} entries.");
        }

        _entries = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in _archive.Entries)
        {
            _entries.TryAdd(Normalise(entry.FullName), entry);
        }
    }

    public IEnumerable<string> Paths => _entries.Keys;

    public bool Exists(string path) => _entries.ContainsKey(Normalise(path));

    public string? ReadText(string path)
    {
        if (!_entries.TryGetValue(Normalise(path), out var entry))
        {
            return null;
        }

        if (entry.Length > MaxEntryBytes)
        {
            throw new InvalidDataException($"Entry '{entry.FullName}' exceeds {MaxEntryBytes} bytes.");
        }

        using var stream = entry.Open();
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = stream.Read(chunk, 0, chunk.Length)) > 0)
        {
            _totalRead += read;
            if (buffer.Length + read > MaxEntryBytes || _totalRead > MaxTotalBytes)
            {
                throw new InvalidDataException("Archive expands beyond the allowed size.");
            }

            buffer.Write(chunk, 0, read);
        }

        var bytes = buffer.ToArray();
        return Encoding.UTF8.GetString(bytes).TrimStart('﻿');
    }

    public static string Normalise(string path) => path.Replace('\\', '/').TrimStart('/');

    public void Dispose() => _archive.Dispose();
}
