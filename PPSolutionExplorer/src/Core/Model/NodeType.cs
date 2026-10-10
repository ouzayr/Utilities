namespace PPSolutionExplorer.Core.Model;

public enum NodeType
{
    Solution,
    Flow,
    Trigger,
    Action,
    Scope,
    Condition,
    Loop,
    Switch,
    App,
    Table,
    Column,
    Relationship,
    EnvVariable,
    ConnectionReference,
    Connector,

    /// <summary>Unrecognised construct. Raw JSON is kept; never dropped.</summary>
    Unknown,
}
