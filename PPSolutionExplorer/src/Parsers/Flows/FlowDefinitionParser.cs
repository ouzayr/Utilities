using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers.Dataverse;
using PPSolutionExplorer.Parsers.Expressions;

namespace PPSolutionExplorer.Parsers.Flows;

/// <summary>
/// Parses a Power Automate cloud flow (Workflow Definition Language) into graph nodes and edges.
/// Accepts the solution file shape (<c>{ "properties": { "definition": ... } }</c>),
/// the legacy package shape (<c>{ "properties": { "definition": ... } }</c> inside <c>definition.json</c>)
/// and a bare definition (<c>{ "triggers": ..., "actions": ... }</c>).
/// </summary>
public static partial class FlowDefinitionParser
{
    private static readonly string[] NestedCollections = ["actions", "else", "cases", "default"];

    /// <summary>Parses a standalone flow JSON document (no solution).</summary>
    public static ComponentGraph ParseStandalone(string json, string fallbackName)
    {
        using var doc = JsonDocument.Parse(json, new JsonDocumentOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip });
        var root = doc.RootElement;
        var graph = new ComponentGraph();

        var id = Str(root, "name") ?? Str(root, "id")?.Split('/').Last() ?? DeterministicId(json);
        var displayName = root.TryGetProperty("properties", out var props) ? Str(props, "displayName") : null;
        var flowNodeId = NodeIds.Flow(id);
        graph.Add(new GraphNode(flowNodeId, NodeType.Flow, displayName ?? fallbackName, RawJson: StripDefinition(root),
            Properties: new Dictionary<string, string> { [NodeProperties.DisplayName] = displayName ?? fallbackName }));

        Parse(graph, flowNodeId, root, FlowParseContext.Standalone);
        return graph;
    }

    /// <summary>Adds the steps of the flow under an existing flow node.</summary>
    public static void Parse(ComponentGraph graph, string flowNodeId, JsonElement root, FlowParseContext context)
    {
        var properties = root.TryGetProperty("properties", out var p) && p.ValueKind == JsonValueKind.Object ? p : root;
        var definition = properties.TryGetProperty("definition", out var d) && d.ValueKind == JsonValueKind.Object ? d : properties;

        if (!definition.TryGetProperty("triggers", out _) && !definition.TryGetProperty("actions", out _))
        {
            graph.AddWarning($"{flowNodeId}: no 'triggers' or 'actions' found. The flow definition shape was not recognised.");
            return;
        }

        var state = new FlowState(graph, flowNodeId, context, properties, definition);
        state.ReadConnectionReferences();
        state.ReadParameters();

        if (definition.TryGetProperty("triggers", out var triggers) && triggers.ValueKind == JsonValueKind.Object)
        {
            var order = 0;
            foreach (var trigger in triggers.EnumerateObject())
            {
                state.AddTrigger(trigger.Name, trigger.Value, order++);
            }
        }

        if (definition.TryGetProperty("actions", out var actions) && actions.ValueKind == JsonValueKind.Object)
        {
            state.AddActions(actions, flowNodeId, branch: null);
        }

        state.ResolveRunAfter();
        state.ResolveExpressions();
    }

    /// <summary>Raw flow JSON without the trigger/action trees (those are stored on the step nodes).</summary>
    public static string StripDefinition(JsonElement root)
    {
        var node = JsonNode.Parse(root.GetRawText())!;
        var definition = node["properties"]?["definition"] ?? node["definition"] ?? node;
        if (definition is JsonObject obj)
        {
            obj.Remove("triggers");
            obj.Remove("actions");
        }

        return node.ToJsonString();
    }

    internal static string? Str(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string DeterministicId(string content)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(content));
        return new Guid(hash.AsSpan(0, 16)).ToString("D");
    }

    private static string StripNested(JsonElement element)
    {
        var node = JsonNode.Parse(element.GetRawText())!;
        if (node is JsonObject obj)
        {
            foreach (var key in NestedCollections)
            {
                obj.Remove(key);
            }

            // Condition: "else": { "actions": {...} }; Switch: "cases": { "X": { "case": ..., "actions": {...} } }.
            // Keep the case values (needed for branch labels) without their actions.
            if (element.TryGetProperty("cases", out var cases) && cases.ValueKind == JsonValueKind.Object)
            {
                var stripped = new JsonObject();
                foreach (var c in cases.EnumerateObject())
                {
                    stripped[c.Name] = c.Value.TryGetProperty("case", out var caseValue) ? new JsonObject { ["case"] = JsonNode.Parse(caseValue.GetRawText()) } : new JsonObject();
                }

                obj["cases"] = stripped;
            }
        }

        return node.ToJsonString();
    }

    [GeneratedRegex(@"\['(?<key>[^']+)'\]")]
    private static partial Regex IndexerKey();

    private sealed class FlowState(ComponentGraph graph, string flowId, FlowParseContext context, JsonElement properties, JsonElement definition)
    {
        private readonly Dictionary<string, (GraphNode Node, JsonElement Json)> _steps = new(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _variables = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _connectionTargets = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string?> _parameters = new(StringComparer.Ordinal);
        private string? _triggerId;
        private int _order;

        public void ReadConnectionReferences()
        {
            if (!properties.TryGetProperty("connectionReferences", out var refs) || refs.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            foreach (var reference in refs.EnumerateObject())
            {
                var apiName = Str(reference.Value.TryGetProperty("api", out var api) ? api : default, "name")
                    ?? Str(reference.Value, "id")?.Split('/').Last()
                    ?? reference.Name;
                var connectorId = NodeIds.Connector(apiName);
                graph.EnsurePlaceholder(connectorId, NodeType.Connector, apiName);

                var logicalName = reference.Value.TryGetProperty("connection", out var connection)
                    ? Str(connection, "connectionReferenceLogicalName")
                    : null;

                string target;
                if (logicalName is not null)
                {
                    target = NodeIds.ConnectionReference(logicalName);
                    graph.EnsurePlaceholder(target, NodeType.ConnectionReference, logicalName,
                        new Dictionary<string, string> { [NodeProperties.ConnectorId] = apiName });
                    graph.AddEdge(new GraphEdge(target, connectorId, EdgeType.UsesConnection));
                }
                else
                {
                    target = connectorId;
                }

                _connectionTargets[reference.Name] = target;
                graph.AddEdge(new GraphEdge(flowId, target, EdgeType.UsesConnection));
            }
        }

        public void ReadParameters()
        {
            if (!definition.TryGetProperty("parameters", out var parameters) || parameters.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            foreach (var parameter in parameters.EnumerateObject())
            {
                var schemaName = parameter.Value.TryGetProperty("metadata", out var metadata) ? Str(metadata, "schemaName") : null;
                _parameters[parameter.Name] = schemaName;
            }
        }

        public void AddTrigger(string name, JsonElement json, int order)
        {
            var type = Str(json, "type");
            var id = NodeIds.Trigger(flowId, name);
            // Triggers sort before every action (actions count up from 0).
            var node = graph.Add(new GraphNode(id, NodeType.Trigger, name, flowId, SubType: type, RawJson: json.GetRawText(),
                Properties: BaseProperties(json), Order: order - 1_000_000));
            _triggerId ??= id;
            _steps[name] = (node, json);
            graph.AddEdge(new GraphEdge(flowId, id, EdgeType.Contains));
            AnalyseConnector(node, json);
        }

        public void AddActions(JsonElement actions, string parentId, string? branch)
        {
            foreach (var action in actions.EnumerateObject())
            {
                AddAction(action.Name, action.Value, parentId, branch);
            }
        }

        private void AddAction(string name, JsonElement json, string parentId, string? branch)
        {
            var type = Str(json, "type");
            var nodeType = ActionTypes.Classify(type);
            var id = NodeIds.Action(flowId, name);
            var properties = BaseProperties(json);

            if (nodeType == NodeType.Switch && json.TryGetProperty("cases", out var switchCases) && switchCases.ValueKind == JsonValueKind.Object)
            {
                properties["cases"] = string.Join('|', switchCases.EnumerateObject().Select(c => "case:" + c.Name));
            }

            if (json.TryGetProperty("runtimeConfiguration", out var runtime) &&
                runtime.TryGetProperty("concurrency", out var concurrency) &&
                concurrency.TryGetProperty("repetitions", out var repetitions))
            {
                properties[NodeProperties.ConcurrencyRepetitions] = repetitions.GetRawText();
            }

            var raw = nodeType.IsContainer() ? StripNested(json) : json.GetRawText();
            if (_steps.ContainsKey(name))
            {
                graph.AddWarning($"{flowId}: duplicate action name '{name}'. Second definition kept as Unknown.");
                id += $"#dup{_order}";
                nodeType = NodeType.Unknown;
            }

            var node = graph.Add(new GraphNode(id, nodeType, name, parentId, branch, type, raw, properties, _order++));
            _steps.TryAdd(name, (node, json));
            graph.AddEdge(new GraphEdge(parentId, id, EdgeType.Contains));

            if (string.Equals(type, "InitializeVariable", StringComparison.OrdinalIgnoreCase) &&
                json.TryGetProperty("inputs", out var inputs) &&
                inputs.TryGetProperty("variables", out var variables) && variables.ValueKind == JsonValueKind.Array)
            {
                foreach (var variable in variables.EnumerateArray())
                {
                    if (Str(variable, "name") is { } variableName)
                    {
                        _variables.TryAdd(variableName, id);
                    }
                }
            }

            AnalyseConnector(node, json);
            AnalyseChildFlow(node, json);

            switch (nodeType)
            {
                case NodeType.Scope or NodeType.Loop:
                    if (json.TryGetProperty("actions", out var body) && body.ValueKind == JsonValueKind.Object)
                    {
                        AddActions(body, id, null);
                    }

                    break;
                case NodeType.Condition:
                    if (json.TryGetProperty("actions", out var yes) && yes.ValueKind == JsonValueKind.Object)
                    {
                        AddActions(yes, id, "true");
                    }

                    if (json.TryGetProperty("else", out var no) && no.TryGetProperty("actions", out var noActions) && noActions.ValueKind == JsonValueKind.Object)
                    {
                        AddActions(noActions, id, "else");
                    }

                    break;
                case NodeType.Switch:
                    if (json.TryGetProperty("cases", out var cases) && cases.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var c in cases.EnumerateObject())
                        {
                            if (c.Value.TryGetProperty("actions", out var caseActions) && caseActions.ValueKind == JsonValueKind.Object)
                            {
                                AddActions(caseActions, id, "case:" + c.Name);
                            }
                        }
                    }

                    if (json.TryGetProperty("default", out var defaultCase) && defaultCase.TryGetProperty("actions", out var defaultActions) && defaultActions.ValueKind == JsonValueKind.Object)
                    {
                        AddActions(defaultActions, id, "default");
                    }

                    break;
            }
        }

        public void ResolveRunAfter()
        {
            foreach (var (node, json) in _steps.Values)
            {
                if (node.Type == NodeType.Trigger || !json.TryGetProperty("runAfter", out var runAfter) || runAfter.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var predecessor in runAfter.EnumerateObject())
                {
                    var statuses = predecessor.Value.ValueKind == JsonValueKind.Array
                        ? predecessor.Value.EnumerateArray().Where(v => v.ValueKind == JsonValueKind.String).Select(v => v.GetString()!)
                        : [];
                    var status = RunStatusExtensions.Parse(statuses);

                    if (_steps.TryGetValue(predecessor.Name, out var source) && source.Node.ParentId == node.ParentId)
                    {
                        graph.AddEdge(new GraphEdge(source.Node.Id, node.Id, EdgeType.RunsAfter, status));
                    }
                    else
                    {
                        graph.AddUnresolved(new UnresolvedReference(node.Id, $"runAfter: {predecessor.Name}",
                            "runAfter refers to an action that is not a sibling in the same scope"));
                    }
                }
            }
        }

        public void ResolveExpressions()
        {
            foreach (var (_, (node, json)) in _steps)
            {
                var scanTarget = node.Type.IsContainer() ? JsonDocument.Parse(node.RawJson!).RootElement : json;
                foreach (var reference in ExpressionScanner.Scan(scanTarget))
                {
                    Resolve(node, reference);
                }
            }
        }

        private void Resolve(GraphNode node, ExpressionReference reference)
        {
            switch (reference.Kind)
            {
                case ReferenceKind.Workflow:
                    return;
                case ReferenceKind.Trigger:
                    if (_triggerId is not null && _triggerId != node.Id)
                    {
                        graph.AddEdge(new GraphEdge(_triggerId, node.Id, EdgeType.DataFlow, Expression: Truncate(reference.Expression)));
                    }

                    return;
            }

            if (reference.Name is null)
            {
                graph.AddUnresolved(new UnresolvedReference(node.Id, reference.Expression, $"{reference.Function}() argument is not a literal"));
                return;
            }

            switch (reference.Kind)
            {
                case ReferenceKind.Action or ReferenceKind.LoopItem:
                    if (_steps.TryGetValue(reference.Name, out var source))
                    {
                        if (source.Node.Id != node.Id)
                        {
                            graph.AddEdge(new GraphEdge(source.Node.Id, node.Id, EdgeType.DataFlow, Expression: Truncate(reference.Expression)));
                        }
                    }
                    else
                    {
                        graph.AddUnresolved(new UnresolvedReference(node.Id, reference.Expression, $"{reference.Function}('{reference.Name}') refers to an unknown action"));
                    }

                    break;

                case ReferenceKind.Variable:
                    if (_variables.TryGetValue(reference.Name, out var declaringAction))
                    {
                        if (declaringAction != node.Id)
                        {
                            graph.AddEdge(new GraphEdge(declaringAction, node.Id, EdgeType.DataFlow, Expression: Truncate(reference.Expression)));
                        }
                    }
                    else
                    {
                        graph.AddUnresolved(new UnresolvedReference(node.Id, reference.Expression, $"variable '{reference.Name}' is not initialised in this flow"));
                    }

                    break;

                case ReferenceKind.Parameter:
                    if (reference.Name.StartsWith('$'))
                    {
                        return; // $connections, $authentication: platform parameters.
                    }

                    if (_parameters.TryGetValue(reference.Name, out var schemaName) && schemaName is not null)
                    {
                        var envId = NodeIds.EnvVariable(schemaName);
                        graph.EnsurePlaceholder(envId, NodeType.EnvVariable, schemaName);
                        graph.AddEdge(new GraphEdge(node.Id, envId, EdgeType.UsesEnvVar, Expression: Truncate(reference.Expression)));
                        graph.AddEdge(new GraphEdge(flowId, envId, EdgeType.UsesEnvVar));
                    }
                    else
                    {
                        graph.AddUnresolved(new UnresolvedReference(node.Id, reference.Expression,
                            $"parameter '{reference.Name}' has no environment variable schemaName in the definition"));
                    }

                    break;
            }
        }

        private Dictionary<string, string> BaseProperties(JsonElement json)
        {
            var properties = new Dictionary<string, string>();
            if (Str(json, "description") is { } description)
            {
                properties[NodeProperties.Description] = description;
            }

            if (json.TryGetProperty("inputs", out var inputs) && inputs.ValueKind == JsonValueKind.Object &&
                inputs.TryGetProperty("host", out var host) && host.ValueKind == JsonValueKind.Object)
            {
                if (Str(host, "operationId") is { } operationId)
                {
                    properties[NodeProperties.OperationId] = operationId;
                }

                if (Str(host, "apiId") is { } apiId)
                {
                    properties[NodeProperties.ConnectorId] = apiId.Split('/').Last();
                }

                var connectionName = Str(host, "connectionName") ?? ConnectionKeyFromLegacy(host);
                if (connectionName is not null)
                {
                    properties[NodeProperties.ConnectionName] = connectionName;
                    if (!properties.ContainsKey(NodeProperties.ConnectorId))
                    {
                        properties[NodeProperties.ConnectorId] = connectionName;
                    }
                }
            }

            return properties;
        }

        private static string? ConnectionKeyFromLegacy(JsonElement host)
        {
            // ApiConnection: "host": { "connection": { "name": "@parameters('$connections')['shared_office365']['connectionId']" } }
            if (host.TryGetProperty("connection", out var connection) && Str(connection, "name") is { } expression)
            {
                var match = IndexerKey().Match(expression);
                return match.Success ? match.Groups["key"].Value : null;
            }

            return null;
        }

        private void AnalyseConnector(GraphNode node, JsonElement json)
        {
            var connectionName = node.Property(NodeProperties.ConnectionName);
            if (connectionName is not null)
            {
                if (_connectionTargets.TryGetValue(connectionName, out var target))
                {
                    graph.AddEdge(new GraphEdge(node.Id, target, EdgeType.UsesConnection));
                }
                else
                {
                    var connectorId = NodeIds.Connector(node.Property(NodeProperties.ConnectorId) ?? connectionName);
                    graph.EnsurePlaceholder(connectorId, NodeType.Connector, node.Property(NodeProperties.ConnectorId) ?? connectionName);
                    graph.AddEdge(new GraphEdge(node.Id, connectorId, EdgeType.UsesConnection));
                }
            }

            var operation = node.Property(NodeProperties.OperationId);
            if (!IsDataverse(node))
            {
                return;
            }

            if (operation is null || !json.TryGetProperty("inputs", out var inputs) || !inputs.TryGetProperty("parameters", out var parameters))
            {
                return;
            }

            var result = DataverseActionAnalyzer.Analyse(operation, parameters);
            if (result.RawTableExpression is not null)
            {
                graph.AddUnresolved(new UnresolvedReference(node.Id, result.RawTableExpression, "Dataverse table name is dynamic"));
            }

            foreach (var raw in result.UnresolvedColumns)
            {
                graph.AddUnresolved(new UnresolvedReference(node.Id, raw, "Dataverse column list is dynamic"));
            }

            if (result.Table is null || result.Access == DataverseAccess.None)
            {
                return;
            }

            var tableName = context.Tables.Resolve(result.Table, out var known);
            var tableId = NodeIds.Table(tableName);
            graph.EnsurePlaceholder(tableId, NodeType.Table, tableName,
                new Dictionary<string, string> { ["nameResolved"] = known ? "true" : "false" });

            var edgeType = result.Access switch
            {
                DataverseAccess.Write => EdgeType.Writes,
                _ => EdgeType.Reads,
            };

            if (result.Access == DataverseAccess.Trigger)
            {
                graph.AddEdge(new GraphEdge(tableId, flowId, EdgeType.Triggers, Expression: operation));
            }

            graph.AddEdge(new GraphEdge(node.Id, tableId, edgeType, Expression: operation));

            foreach (var column in result.ReadColumns)
            {
                LinkColumn(node.Id, tableName, column, EdgeType.Reads);
            }

            foreach (var column in result.WrittenColumns)
            {
                LinkColumn(node.Id, tableName, column, EdgeType.Writes);
            }
        }

        private bool IsDataverse(GraphNode node)
        {
            if (DataverseActionAnalyzer.IsDataverse(node.Property(NodeProperties.ConnectorId)))
            {
                return true;
            }

            // Solution flows: the action names a connection reference key; the reference names the connector.
            var connectionName = node.Property(NodeProperties.ConnectionName);
            return connectionName is not null &&
                _connectionTargets.TryGetValue(connectionName, out var target) &&
                graph.Outgoing(target, EdgeType.UsesConnection).Any(e => DataverseActionAnalyzer.IsDataverse(e.TargetId)) ||
                connectionName is not null && _connectionTargets.TryGetValue(connectionName, out var direct) && DataverseActionAnalyzer.IsDataverse(direct);
        }

        private void LinkColumn(string stepId, string table, string column, EdgeType edgeType)
        {
            var tableId = NodeIds.Table(table);
            var columnId = NodeIds.Column(table, column);
            if (!graph.Contains(columnId))
            {
                graph.Add(new GraphNode(columnId, NodeType.Column, column, tableId,
                    Properties: new Dictionary<string, string> { [NodeProperties.Placeholder] = "true", [NodeProperties.TableName] = table }));
                graph.AddEdge(new GraphEdge(tableId, columnId, EdgeType.Contains));
            }

            graph.AddEdge(new GraphEdge(stepId, columnId, edgeType));
        }

        private void AnalyseChildFlow(GraphNode node, JsonElement json)
        {
            if (!string.Equals(node.SubType, "Workflow", StringComparison.OrdinalIgnoreCase) ||
                !json.TryGetProperty("inputs", out var inputs) || !inputs.TryGetProperty("host", out var host))
            {
                return;
            }

            var reference = Str(host, "workflowReferenceName");
            if (reference is null || reference.Contains('@'))
            {
                graph.AddUnresolved(new UnresolvedReference(node.Id, reference ?? host.GetRawText(), "child flow reference is missing or dynamic"));
                return;
            }

            var childId = NodeIds.Flow(reference);
            graph.EnsurePlaceholder(childId, NodeType.Flow, reference);
            graph.AddEdge(new GraphEdge(node.Id, childId, EdgeType.Calls));
            graph.AddEdge(new GraphEdge(flowId, childId, EdgeType.Calls));
        }

        private static string Truncate(string value) => value.Length <= 500 ? value : value[..500] + "…";
    }
}
