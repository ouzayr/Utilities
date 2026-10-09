using System.Text.Json;
using System.Text.Json.Nodes;

namespace PPSolutionExplorer.Ai.Validation;

/// <summary>
/// Minimal JSON-schema validator for the subset our prompt schemas use:
/// type, properties, required, additionalProperties=false, items, enum, maxLength, maxItems.
/// Model output is untrusted: it is validated before it is stored or used.
/// </summary>
public static class SchemaValidator
{
    public static IReadOnlyList<string> Validate(JsonNode? value, JsonObject schema)
    {
        var errors = new List<string>();
        Check(value, schema, "$", errors);
        return errors;
    }

    public static bool TryParse(string content, JsonObject schema, out JsonNode? node, out IReadOnlyList<string> errors)
    {
        try
        {
            node = JsonNode.Parse(content);
        }
        catch (JsonException ex)
        {
            node = null;
            errors = [$"invalid JSON: {ex.Message}"];
            return false;
        }

        errors = Validate(node, schema);
        return errors.Count == 0;
    }

    private static void Check(JsonNode? value, JsonObject schema, string path, List<string> errors)
    {
        var type = schema["type"]?.GetValue<string>();
        switch (type)
        {
            case "object":
                if (value is not JsonObject obj)
                {
                    errors.Add($"{path}: expected object");
                    return;
                }

                var properties = schema["properties"] as JsonObject ?? [];
                foreach (var required in (schema["required"] as JsonArray ?? []).Select(r => r!.GetValue<string>()))
                {
                    if (!obj.ContainsKey(required))
                    {
                        errors.Add($"{path}.{required}: required");
                    }
                }

                var additional = schema["additionalProperties"] is JsonValue v && v.TryGetValue<bool>(out var allowed) ? allowed : true;
                foreach (var (key, child) in obj)
                {
                    if (properties[key] is JsonObject childSchema)
                    {
                        Check(child, childSchema, $"{path}.{key}", errors);
                    }
                    else if (!additional)
                    {
                        errors.Add($"{path}.{key}: not allowed");
                    }
                }

                break;

            case "array":
                if (value is not JsonArray array)
                {
                    errors.Add($"{path}: expected array");
                    return;
                }

                if (schema["maxItems"] is JsonValue max && array.Count > max.GetValue<int>())
                {
                    errors.Add($"{path}: more than {max} items");
                }

                if (schema["items"] is JsonObject itemSchema)
                {
                    for (var i = 0; i < array.Count; i++)
                    {
                        Check(array[i], itemSchema, $"{path}[{i}]", errors);
                    }
                }

                break;

            case "string":
                if (value is not JsonValue sv || !sv.TryGetValue<string>(out var text))
                {
                    errors.Add($"{path}: expected string");
                    return;
                }

                if (schema["maxLength"] is JsonValue maxLength && text.Length > maxLength.GetValue<int>())
                {
                    errors.Add($"{path}: longer than {maxLength}");
                }

                if (schema["enum"] is JsonArray options && !options.Any(o => o?.GetValue<string>() == text))
                {
                    errors.Add($"{path}: '{text}' is not an allowed value");
                }

                break;

            case "boolean":
                if (value is not JsonValue bv || !bv.TryGetValue<bool>(out _))
                {
                    errors.Add($"{path}: expected boolean");
                }

                break;

            case "integer" or "number":
                if (value is not JsonValue nv || nv.GetValueKind() != JsonValueKind.Number)
                {
                    errors.Add($"{path}: expected number");
                }

                break;
        }
    }
}
