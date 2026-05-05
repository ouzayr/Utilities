using CardForge.Domain.Enums;

namespace CardForge.Application.Exceptions;

public class TierLimitException : Exception
{
    public SubscriptionTier CurrentTier { get; }
    public SubscriptionTier RequiredTier { get; }

    public TierLimitException(string message, SubscriptionTier currentTier, SubscriptionTier requiredTier)
        : base(message)
    {
        CurrentTier = currentTier;
        RequiredTier = requiredTier;
    }
}
