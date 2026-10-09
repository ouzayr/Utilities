using System.Text.Json;
using System.Xml.Linq;
using PPSolutionExplorer.Core.Graph;
using PPSolutionExplorer.Core.Model;
using PPSolutionExplorer.Parsers.Dataverse;
using PPSolutionExplorer.Parsers.Flows;

namespace PPSolutionExplorer.Parsers.Solutions;

/// <summary>
/// Parses an exported Power Platform solution zip (unmanaged or managed) and the legacy flow package zip.
/// Read-only: the archive is read in memory and never modified or re-exported.
/// </summary>
/// <remarks>
/// Layout assumptions (verify against real exports; the format is not formally versioned):
/// <c>solution.xml</c>, <c>customizations.xml</c>, <c>Workflows/*.json</c>,
/// <c>environmentvariabledefinitions/&lt;schema&gt;/environmentvariabledefinition.xml</c> (+ <c>environmentvariablevalues.json</c>),
/// connection references inside <c>customizations.xml</c>.
/// Legacy package: <c>manifest.json</c> + <c>Microsoft.Flow/flows/&lt;id&gt;/definition.json</c>.
/// </remarks>
public static class SolutionZipParser
{
    private const string ModernFlowCategory = "5";
    private const string SecretEnvVarType = "100000005";

    private static readonly JsonDocumentOptions JsonOptions = new() { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip };

    public static ParseResult Parse(Stream zipStream, string fileName)
    {
        using var zip = new SafeZipReader(zipStream);

        if (zip.Exists("solution.xml"))
        {
            return ParseSolution(zip, fileName);
        }

        if (zip.Paths.Any(p => p.StartsWith("Microsoft.Flow/flows/", StringComparison.OrdinalIgnoreCase) && p.EndsWith("/definition.json", StringComparison.OrdinalIgnoreCase)))
        {
            return ParsePackage(zip, fileName);
        }

        throw new InvalidDataException("Archive is neither a solution export (solution.xml) nor a flow package (Microsoft.Flow/flows/*/definition.json).");
    }

    private static ParseResult ParseSolution(SafeZipReader zip, string fileName)
    {
        var graph = new ComponentGraph();
        var manifest = XmlHelpers.Load(zip.ReadText("solution.xml")!).All("SolutionManifest").FirstOrDefault()
            ?? throw new InvalidDataException("solution.xml has no SolutionManifest.");

        var uniqueName = manifest.ChildValue("UniqueName") ?? Path.GetFileNameWithoutExtension(fileName);
        var displayName = manifest.Child("LocalizedNames").Localized() ?? uniqueName;
        var version = manifest.ChildValue("Version") ?? "unknown";
        var solutionId = NodeIds.Solution(uniqueName);
        graph.Add(new GraphNode(solutionId, NodeType.Solution, displayName, SubType: manifest.ChildValue("Managed") == "1" ? "Managed" : "Unmanaged",
            RawJson: null,
            Properties: new Dictionary<string, string>
            {
                [NodeProperties.DisplayName] = displayName,
                [NodeProperties.Version] = version,
                [NodeProperties.Managed] = manifest.ChildValue("Managed") ?? "0",
                ["uniqueName"] = uniqueName,
            }));

        var customizationsXml = zip.ReadText("customizations.xml");
        var customizations = customizationsXml is null ? null : XmlHelpers.Load(customizationsXml);
        if (customizations is null)
        {
            graph.AddWarning("customizations.xml not found. Flows are discovered from Workflows/*.json only.");
        }

        var tables = new TableNameResolver();
        if (customizations is not null)
        {
            ReadEntities(customizations, graph, solutionId, tables);
            ReadConnectionReferences(customizations, graph, solutionId);
            ReadApps(customizations, graph, solutionId);
        }

        ReadEnvironmentVariables(zip, graph, solutionId);

        var context = new FlowParseContext { Tables = tables, SolutionNodeId = solutionId };
        var parsedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var workflow in customizations?.All("Workflow") ?? [])
        {
            var category = workflow.ChildValue("Category");
            var jsonFile = workflow.ChildValue("JsonFileName");
            var workflowId = workflow.Attr("WorkflowId");
            var name = workflow.Attr("Name") ?? workflow.Child("LocalizedNames").Localized() ?? workflowId ?? "Unnamed flow";

            if (category != ModernFlowCategory || jsonFile is null || workflowId is null)
            {
                // Classic workflows, business rules, BPFs, desktop flows: recorded, not parsed.
                if (workflowId is not null && category != ModernFlowCategory)
                {
                    graph.AddWarning($"Workflow '{name}' (category {category ?? "?"}) is not a cloud flow and was not parsed.");
                }

                continue;
            }

            var json = zip.ReadText(jsonFile);
            if (json is null)
            {
                graph.AddWarning($"Flow '{name}': file '{jsonFile}' listed in customizations.xml was not found in the archive.");
                continue;
            }

            parsedFiles.Add(SafeZipReader.Normalise(jsonFile));
            AddFlow(graph, context, solutionId, workflowId, name, json, new Dictionary<string, string>
            {
                [NodeProperties.State] = workflow.ChildValue("StateCode") == "1" ? "On" : "Off",
                [NodeProperties.Category] = category,
                ["file"] = SafeZipReader.Normalise(jsonFile),
            }, workflow.ToString());
        }

        foreach (var path in zip.Paths.Where(p => p.StartsWith("Workflows/", StringComparison.OrdinalIgnoreCase) && p.EndsWith(".json", StringComparison.OrdinalIgnoreCase)))
        {
            if (parsedFiles.Contains(path))
            {
                continue;
            }

            // Not listed in customizations.xml. File name pattern is "<Name>-<GUID>.json".
            var stem = Path.GetFileNameWithoutExtension(path);
            var guidPart = stem.Length > 36 ? stem[^36..] : null;
            if (guidPart is null || !Guid.TryParse(guidPart, out _))
            {
                graph.AddWarning($"'{path}' is not listed in customizations.xml and its file name has no flow ID. Skipped.");
                continue;
            }

            graph.AddWarning($"'{path}' is not listed in customizations.xml. Parsed using the ID from the file name.");
            AddFlow(graph, context, solutionId, guidPart, stem[..^37].Replace('_', ' '), zip.ReadText(path)!, new Dictionary<string, string> { ["file"] = path }, null);
        }

        return new ParseResult(ImportKind.Solution, displayName, version, graph);
    }

    private static ParseResult ParsePackage(SafeZipReader zip, string fileName)
    {
        var graph = new ComponentGraph();
        var displayNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (zip.ReadText("manifest.json") is { } manifestJson)
        {
            using var manifest = JsonDocument.Parse(manifestJson, JsonOptions);
            if (manifest.RootElement.TryGetProperty("resources", out var resources) && resources.ValueKind == JsonValueKind.Object)
            {
                foreach (var resource in resources.EnumerateObject())
                {
                    if (FlowDefinitionParser.Str(resource.Value, "type") == "Microsoft.Flow/flows" &&
                        resource.Value.TryGetProperty("details", out var details) &&
                        FlowDefinitionParser.Str(details, "displayName") is { } name)
                    {
                        displayNames[resource.Name] = name;
                    }
                }
            }
        }

        foreach (var path in zip.Paths.Where(p => p.StartsWith("Microsoft.Flow/flows/", StringComparison.OrdinalIgnoreCase) && p.EndsWith("/definition.json", StringComparison.OrdinalIgnoreCase)))
        {
            var folder = path.Split('/')[2];
            var json = zip.ReadText(path)!;
            using var doc = JsonDocument.Parse(json, JsonOptions);
            var flowId = FlowDefinitionParser.Str(doc.RootElement, "name") ?? folder;
            var name = (doc.RootElement.TryGetProperty("properties", out var p) ? FlowDefinitionParser.Str(p, "displayName") : null)
                ?? displayNames.GetValueOrDefault(folder) ?? folder;
            AddFlow(graph, FlowParseContext.Standalone, null, flowId, name, json, new Dictionary<string, string> { ["file"] = path }, null);
        }

        var title = Path.GetFileNameWithoutExtension(fileName);
        return new ParseResult(ImportKind.Package, title, null, graph);
    }

    private static void AddFlow(ComponentGraph graph, FlowParseContext context, string? solutionId, string workflowId, string name, string json,
        Dictionary<string, string> properties, string? metadataXml)
    {
        try
        {
            using var doc = JsonDocument.Parse(json, JsonOptions);
            var flowId = NodeIds.Flow(workflowId);
            properties[NodeProperties.DisplayName] = name;
            if (metadataXml is not null)
            {
                properties["solutionMetadata"] = metadataXml;
            }

            graph.Add(new GraphNode(flowId, NodeType.Flow, name, RawJson: FlowDefinitionParser.StripDefinition(doc.RootElement), Properties: properties));
            if (solutionId is not null)
            {
                graph.AddEdge(new GraphEdge(solutionId, flowId, EdgeType.Contains));
            }

            FlowDefinitionParser.Parse(graph, flowId, doc.RootElement, context);
        }
        catch (JsonException ex)
        {
            graph.AddWarning($"Flow '{name}': invalid JSON ({ex.Message}). Skipped.");
        }
    }

    private static void ReadEntities(XDocument customizations, ComponentGraph graph, string solutionId, TableNameResolver tables)
    {
        foreach (var entity in customizations.All("Entity"))
        {
            var info = entity.Child("EntityInfo")?.Child("entity");
            var logicalName = (info?.Attr("Name") ?? entity.ChildValue("Name"))?.ToLowerInvariant();
            if (logicalName is null)
            {
                continue;
            }

            var entitySet = info?.ChildValue("EntitySetName");
            tables.Register(logicalName, entitySet);

            var tableId = NodeIds.Table(logicalName);
            var displayName = entity.Child("Name")?.Attr("LocalizedName") ?? info?.Child("LocalizedNames").Localized() ?? logicalName;
            var properties = new Dictionary<string, string> { [NodeProperties.DisplayName] = displayName, ["nameResolved"] = "true" };
            if (entitySet is not null)
            {
                properties["entitySetName"] = entitySet;
            }

            graph.Add(new GraphNode(tableId, NodeType.Table, logicalName, Properties: properties));
            graph.AddEdge(new GraphEdge(solutionId, tableId, EdgeType.Contains));

            var order = 0;
            foreach (var attribute in info?.Child("attributes")?.Elements() ?? [])
            {
                var column = (attribute.ChildValue("LogicalName") ?? attribute.Attr("PhysicalName"))?.ToLowerInvariant();
                if (column is null)
                {
                    continue;
                }

                var columnId = NodeIds.Column(logicalName, column);
                graph.Add(new GraphNode(columnId, NodeType.Column, column, tableId, SubType: attribute.ChildValue("Type"),
                    Properties: new Dictionary<string, string> { [NodeProperties.TableName] = logicalName, [NodeProperties.DisplayName] = attribute.Child("displaynames").Localized() ?? column },
                    Order: order++));
                graph.AddEdge(new GraphEdge(tableId, columnId, EdgeType.Contains));
            }
        }

        foreach (var relationship in customizations.All("EntityRelationship"))
        {
            var name = relationship.Attr("Name");
            var referencing = relationship.ChildValue("ReferencingEntityName")?.ToLowerInvariant();
            var referenced = relationship.ChildValue("ReferencedEntityName")?.ToLowerInvariant();
            if (name is null)
            {
                continue;
            }

            var id = $"rel:{name.ToLowerInvariant()}";
            var properties = new Dictionary<string, string>();
            if (referencing is not null)
            {
                properties["referencing"] = referencing;
            }

            if (referenced is not null)
            {
                properties["referenced"] = referenced;
            }

            graph.Add(new GraphNode(id, NodeType.Relationship, name, SubType: relationship.ChildValue("EntityRelationshipType"), Properties: properties));
            graph.AddEdge(new GraphEdge(solutionId, id, EdgeType.Contains));
            foreach (var table in new[] { referencing, referenced }.OfType<string>())
            {
                var tableId = NodeIds.Table(table);
                graph.EnsurePlaceholder(tableId, NodeType.Table, table);
                graph.AddEdge(new GraphEdge(id, tableId, EdgeType.Reads));
            }
        }
    }

    private static void ReadConnectionReferences(XDocument customizations, ComponentGraph graph, string solutionId)
    {
        foreach (var reference in customizations.All("connectionreference"))
        {
            var logicalName = reference.Attr("connectionreferencelogicalname");
            if (logicalName is null)
            {
                continue;
            }

            var connectorPath = reference.ChildValue("connectorid");
            var apiName = connectorPath?.Split('/').Last();
            var id = NodeIds.ConnectionReference(logicalName);
            var properties = new Dictionary<string, string>
            {
                [NodeProperties.DisplayName] = reference.ChildValue("connectionreferencedisplayname") ?? logicalName,
            };
            if (apiName is not null)
            {
                properties[NodeProperties.ConnectorId] = apiName;
            }

            graph.Add(new GraphNode(id, NodeType.ConnectionReference, logicalName, RawJson: null, Properties: properties));
            graph.AddEdge(new GraphEdge(solutionId, id, EdgeType.Contains));
            if (apiName is not null)
            {
                var connectorId = NodeIds.Connector(apiName);
                graph.EnsurePlaceholder(connectorId, NodeType.Connector, apiName);
                graph.AddEdge(new GraphEdge(id, connectorId, EdgeType.UsesConnection));
            }
        }
    }

    private static void ReadApps(XDocument customizations, ComponentGraph graph, string solutionId)
    {
        foreach (var app in customizations.All("CanvasApp"))
        {
            var name = app.ChildValue("Name");
            if (name is null)
            {
                continue;
            }

            var id = NodeIds.App(name);
            graph.Add(new GraphNode(id, NodeType.App, app.ChildValue("DisplayName") ?? name, SubType: "Canvas",
                Properties: new Dictionary<string, string> { ["uniqueName"] = name }));
            graph.AddEdge(new GraphEdge(solutionId, id, EdgeType.Contains));
        }

        foreach (var app in customizations.All("AppModule"))
        {
            var name = app.ChildValue("UniqueName");
            if (name is null)
            {
                continue;
            }

            var id = NodeIds.App(name);
            graph.Add(new GraphNode(id, NodeType.App, app.Child("LocalizedNames").Localized() ?? name, SubType: "ModelDriven",
                Properties: new Dictionary<string, string> { ["uniqueName"] = name }));
            graph.AddEdge(new GraphEdge(solutionId, id, EdgeType.Contains));
        }
    }

    private static void ReadEnvironmentVariables(SafeZipReader zip, ComponentGraph graph, string solutionId)
    {
        foreach (var path in zip.Paths.Where(p => p.StartsWith("environmentvariabledefinitions/", StringComparison.OrdinalIgnoreCase) &&
                                               p.EndsWith("/environmentvariabledefinition.xml", StringComparison.OrdinalIgnoreCase)))
        {
            var definition = XmlHelpers.Load(zip.ReadText(path)!).Root;
            var schemaName = definition?.Attr("schemaname");
            if (definition is null || schemaName is null)
            {
                continue;
            }

            var type = definition.ChildValue("type");
            var isSecret = type == SecretEnvVarType;
            var properties = new Dictionary<string, string>
            {
                [NodeProperties.DisplayName] = definition.Child("displayname").Localized() ?? schemaName,
                ["type"] = type ?? "unknown",
            };

            if (!isSecret && definition.ChildValue("defaultvalue") is { } defaultValue)
            {
                properties[NodeProperties.DefaultValue] = defaultValue;
            }

            var valuesPath = path[..path.LastIndexOf('/')] + "/environmentvariablevalues.json";
            if (!isSecret && zip.ReadText(valuesPath) is { } valuesJson && CurrentValue(valuesJson) is { } current)
            {
                properties[NodeProperties.CurrentValue] = current;
            }

            var id = NodeIds.EnvVariable(schemaName);
            graph.Add(new GraphNode(id, NodeType.EnvVariable, schemaName, SubType: isSecret ? "Secret" : type, Properties: properties));
            graph.AddEdge(new GraphEdge(solutionId, id, EdgeType.Contains));
        }
    }

    private static string? CurrentValue(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json, JsonOptions);
            return FindValue(doc.RootElement);
        }
        catch (JsonException)
        {
            return null;
        }

        static string? FindValue(JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in element.EnumerateObject())
                {
                    if (property.NameEquals("value") && property.Value.ValueKind == JsonValueKind.String)
                    {
                        return property.Value.GetString();
                    }

                    if (FindValue(property.Value) is { } nested)
                    {
                        return nested;
                    }
                }
            }

            return null;
        }
    }
}
