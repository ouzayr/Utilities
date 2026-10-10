using PPSolutionExplorer.Ai.Redaction;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;

namespace PPSolutionExplorer.Ai.Services;

internal static class FlowContext
{
    /// <summary>Redactor primed with every environment variable value in the graph.</summary>
    public static Redactor RedactorFor(ComponentGraph graph, AiOptions options)
    {
        var values = graph.Nodes
            .Where(n => n.Type == NodeType.EnvVariable)
            .SelectMany(n => new[] { n.Property(NodeProperties.DefaultValue), n.Property(NodeProperties.CurrentValue) }
                .OfType<string>()
                .Select(v => (n.Name, v)));
        return new Redactor(options.Redaction, values);
    }
}
