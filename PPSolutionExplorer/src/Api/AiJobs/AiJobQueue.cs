using System.Threading.Channels;

namespace PPSolutionExplorer.Api.AiJobs;

public sealed record AiJobRequest(Guid JobId, string Kind, Guid ImportId, string NodeId);

/// <summary>In-process queue. Local inference is slow, so AI work never runs on the request thread.</summary>
public sealed class AiJobQueue
{
    private readonly Channel<AiJobRequest> _channel = Channel.CreateBounded<AiJobRequest>(new BoundedChannelOptions(1000)
    {
        FullMode = BoundedChannelFullMode.Wait,
        SingleReader = false,
    });

    public ValueTask EnqueueAsync(AiJobRequest request, CancellationToken ct) => _channel.Writer.WriteAsync(request, ct);

    public IAsyncEnumerable<AiJobRequest> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
