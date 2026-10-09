namespace PPSolutionExplorer.Core.Model;

public static class NodeTypeExtensions
{
    /// <summary>Nodes that hold nested flow actions.</summary>
    public static bool IsContainer(this NodeType type) =>
        type is NodeType.Scope or NodeType.Condition or NodeType.Loop or NodeType.Switch;

    /// <summary>Nodes that live inside a flow's execution tree.</summary>
    public static bool IsFlowStep(this NodeType type) =>
        type is NodeType.Trigger or NodeType.Action or NodeType.Unknown || type.IsContainer();
}
