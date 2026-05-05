"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/layout/TenantShell";
import { getMe } from "@/lib/auth";
import { api } from "@/lib/api";
import type { MeResponse, CardDto, TemplateDto } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    api.get<CardDto[]>("/api/cards").then((c) => setCardCount(c.length)).catch(() => {});
    api.get<TemplateDto[]>("/api/templates").then((t) => setTemplateCount(t.length)).catch(() => {});
  }, []);

  return (
    <TenantShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {me?.firstName ?? "…"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {me?.tenantName} · {me?.activeTier ?? "Starter"} plan
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="My Cards" value={cardCount} href="/cards" />
          <StatCard label="Templates" value={templateCount} href="/templates" />
          <StatCard label="Subscription" value={me?.activeTier ?? "Starter"} href="/subscriptions" />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/cards" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
            + New Card
          </Link>
          <Link href="/templates" className="border px-4 py-2 rounded-md text-sm font-medium hover:bg-accent">
            Browse Templates
          </Link>
        </div>
      </div>
    </TenantShell>
  );
}

function StatCard({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href}
      className="bg-card border rounded-lg p-5 hover:shadow-md transition-shadow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </Link>
  );
}
