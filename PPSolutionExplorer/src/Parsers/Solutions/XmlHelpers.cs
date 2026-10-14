using System.Xml;
using System.Xml.Linq;

namespace PPSolutionExplorer.Parsers.Solutions;

internal static class XmlHelpers
{
    private static readonly XmlReaderSettings Settings = new()
    {
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null,
        IgnoreComments = true,
    };

    public static XDocument Load(string xml)
    {
        using var reader = XmlReader.Create(new StringReader(xml), Settings);
        return XDocument.Load(reader);
    }

    /// <summary>Element lookup by local name, ignoring case and namespaces (export casing is not consistent).</summary>
    public static IEnumerable<XElement> All(this XContainer container, string name) =>
        container.Descendants().Where(e => string.Equals(e.Name.LocalName, name, StringComparison.OrdinalIgnoreCase));

    public static XElement? Child(this XElement element, string name) =>
        element.Elements().FirstOrDefault(e => string.Equals(e.Name.LocalName, name, StringComparison.OrdinalIgnoreCase));

    public static string? ChildValue(this XElement element, string name) => element.Child(name)?.Value.Trim() is { Length: > 0 } v ? v : null;

    public static string? Attr(this XElement element, string name) =>
        element.Attributes().FirstOrDefault(a => string.Equals(a.Name.LocalName, name, StringComparison.OrdinalIgnoreCase))?.Value;

    /// <summary>First LocalizedName/label description under the element (prefers 1033).</summary>
    public static string? Localized(this XElement? element)
    {
        if (element is null)
        {
            return null;
        }

        var labels = element.Descendants()
            .Where(e => e.Name.LocalName is "LocalizedName" or "label")
            .ToList();
        var preferred = labels.FirstOrDefault(l => l.Attr("languagecode") == "1033") ?? labels.FirstOrDefault();
        return preferred?.Attr("description") ?? element.Attr("default");
    }
}
