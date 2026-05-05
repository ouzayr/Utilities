"use client";

import type { SubscriptionTier } from "@/types";

const TIER_ORDER: Record<SubscriptionTier, number> = {
  Starter: 0,
  Professional: 1,
  Enterprise: 2,
};

interface TierGateProps {
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function TierGate({
  currentTier,
  requiredTier,
  children,
  fallback,
}: TierGateProps) {
  const hasAccess = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

  if (!hasAccess) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <span title={`Requires ${requiredTier} plan`} className="opacity-50 cursor-not-allowed">
          {children}
        </span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full border">
          {requiredTier}+
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
