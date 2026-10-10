using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PPSolutionExplorer.Ai.Llm;
using PPSolutionExplorer.Ai.Prompts;
using PPSolutionExplorer.Ai.Services;

namespace PPSolutionExplorer.Ai;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the AI layer. With <c>Ai:Enabled=false</c> a no-op client is registered and no HTTP client exists.
    /// The store implementation (<see cref="IAiOutputStore"/>) is registered by the host.
    /// </summary>
    public static IServiceCollection AddExplorerAi(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(AiOptions.Section);
        services.Configure<AiOptions>(section);
        var options = section.Get<AiOptions>() ?? new AiOptions();

        if (options.Enabled)
        {
            LlamaCppClient.EnsureLoopback(options.BaseUrl);
            services.AddHttpClient<ILlmClient, LlamaCppClient>()
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { UseProxy = false });
        }
        else
        {
            services.AddSingleton<ILlmClient, DisabledLlmClient>();
        }

        services.AddSingleton<IPromptLibrary, PromptLibrary>();
        services.AddScoped<AiRunner>();
        services.AddScoped<FlowSummaryService>();
        services.AddScoped<StepAiService>();
        return services;
    }
}
