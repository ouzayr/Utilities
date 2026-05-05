"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/layout/PlatformShell";
import { api } from "@/lib/api";
import type { TenantDto, ApiError } from "@/types";
import { toast } from "sonner";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TenantDto[]>("/api/tenants")
      .then(setTenants)
      .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load tenants"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PlatformShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tenants</h1>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Slug</th>
                  <th className="text-left px-4 py-3 font-medium">Policy</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.slug}</td>
                    <td className="px-4 py-3 text-xs">{t.templateCreationPolicy}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${t.isActive ? "text-green-600" : "text-red-500"}`}>
                        {t.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t.id}`}
                        className="text-primary hover:underline text-xs">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
