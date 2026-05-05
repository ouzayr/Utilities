"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/layout/TenantShell";
import { api } from "@/lib/api";
import type { SubscriptionDto, ApiError } from "@/types";
import { toast } from "sonner";

const TIERS = [
  { name: "Starter", price: "Free", users: 10, templates: 3, exports: "VCF only", whiteLabel: false },
  { name: "Professional", price: "$29/mo", users: 50, templates: 20, exports: "VCF + PDF/PNG", whiteLabel: false },
  { name: "Enterprise", price: "$99/mo", users: "Unlimited", templates: "Unlimited", exports: "VCF + PDF/PNG", whiteLabel: true },
];

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SubscriptionDto[]>("/api/subscriptions")
      .then(setSubscriptions)
      .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load subscriptions"))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(tier: string) {
    try {
      const prices: Record<string, number> = { Professional: 2900, Enterprise: 9900 };
      const result = await api.post<SubscriptionDto>("/api/subscriptions", {
        tier,
        amountCents: prices[tier] ?? 0,
        currency: "USD",
      });
      setSubscriptions((prev) => [result, ...prev]);
      toast.success(`Upgraded to ${tier}!`);
    } catch (e) {
      toast.error((e as ApiError).detail ?? "Upgrade failed");
    }
  }

  const active = subscriptions.find((s) => s.status === "Active");

  return (
    <TenantShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Subscription</h1>

        {active && (
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-xl font-bold">{active.tier}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Active since {new Date(active.startsAt).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((tier) => {
            const isCurrent = active?.tier === tier.name;
            return (
              <div key={tier.name}
                className={`bg-card border rounded-lg p-5 space-y-3 ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}>
                <div>
                  <p className="font-bold text-lg">{tier.name}</p>
                  <p className="text-2xl font-bold mt-1">{tier.price}</p>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>Up to {tier.users} users</li>
                  <li>Up to {tier.templates} templates</li>
                  <li>{tier.exports}</li>
                  {tier.whiteLabel && <li>White-label branding</li>}
                </ul>
                {isCurrent ? (
                  <span className="block text-center text-sm text-primary font-medium py-2">Current Plan</span>
                ) : tier.name !== "Starter" ? (
                  <button
                    onClick={() => handleUpgrade(tier.name)}
                    className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90">
                    Upgrade
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {!loading && subscriptions.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">Billing History</h2>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Plan</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">{s.tier}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${s.status === "Active" ? "text-green-600" : "text-muted-foreground"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(s.startsAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
