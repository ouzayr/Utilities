using Microsoft.AspNetCore.Diagnostics;
using PPSolutionExplorer.Ai.Llm;

namespace PPSolutionExplorer.Api.Infrastructure;

/// <summary>Maps known exceptions to problem responses. Unexpected errors are logged and returned as 500 without details.</summary>
public sealed class ErrorHandling(ILogger<ErrorHandling> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            AiDisabledException => (StatusCodes.Status503ServiceUnavailable, "AI is disabled. Set Ai:Enabled=true and start llama-server."),
            LlmException => (StatusCodes.Status502BadGateway, "The local model server failed: " + exception.Message),
            InvalidDataException => (StatusCodes.Status400BadRequest, exception.Message),
            System.Text.Json.JsonException => (StatusCodes.Status400BadRequest, "Invalid JSON: " + exception.Message),
            ArgumentException => (StatusCodes.Status400BadRequest, exception.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected error."),
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled error on {Path}", context.Request.Path);
        }

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new { status, title }, ct);
        return true;
    }
}
