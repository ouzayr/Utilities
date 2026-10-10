using PPSolutionExplorer.Parsers.Flows;
using PPSolutionExplorer.Parsers.Solutions;

namespace PPSolutionExplorer.Parsers;

/// <summary>Entry point: picks the parser from the file content.</summary>
public static class ImportParser
{
    public static ParseResult Parse(Stream content, string fileName)
    {
        ArgumentNullException.ThrowIfNull(content);
        var seekable = content.CanSeek ? content : Buffer(content);
        var header = new byte[4];
        var read = seekable.Read(header, 0, header.Length);
        seekable.Position = 0;

        // "PK\x03\x04": zip.
        if (read == 4 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04)
        {
            return SolutionZipParser.Parse(seekable, fileName);
        }

        using var reader = new StreamReader(seekable, leaveOpen: true);
        var json = reader.ReadToEnd();
        var name = Path.GetFileNameWithoutExtension(fileName);
        var graph = FlowDefinitionParser.ParseStandalone(json, name);
        return new ParseResult(ImportKind.Flow, name, null, graph);
    }

    private static MemoryStream Buffer(Stream stream)
    {
        var memory = new MemoryStream();
        stream.CopyTo(memory);
        memory.Position = 0;
        return memory;
    }
}
