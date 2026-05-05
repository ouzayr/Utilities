"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, getStoredAuth } from "@/lib/auth";
import type { AuthResponse, SubscriptionTier } from "@/types";
import { api } from "@/lib/api";

const TIER_COLORS: Record<SubscriptionTier, string> = {
  Starter: "bg-gray-100 text-gray-700",
  Professional: "bg-blue-100 text-blue-700",
  Enterprise: "bg-purple-100 text-purple-700",
};

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "My Cards" },
  { href: "/templates", label: "Templates" },
  { href: "/users", label: "Users" },
  { href: "/subscriptions", label: "Subscription" },
];

export default function TenantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("Starter");

  useEffect(() => {
    const stored = getStoredAuth();
    setAuth(stored);
    if (stored) {
      api.get<{ activeTier: SubscriptionTier }>("/api/auth/me")
        .then((me) => setTier(me.activeTier ?? "Starter"))
        .catch(() => {});
    }
  }, []);

  return (
    <div className="flex h-screen bg-muted">
      <aside className="w-56 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <p className="font-bold text-lg">CardForge</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_COLORS[tier]}`}>{tier}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          {auth && (
            <p className="text-xs text-muted-foreground mb-2 truncate">
              {auth.firstName} {auth.lastName}
            </p>
          )}
          <button
            onClick={logout}
            className="w-full text-left text-sm text-destructive hover:underline px-3 py-1"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
