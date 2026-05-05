"use client";

import { useEffect, useState } from "react";
import TenantShell from "@/components/layout/TenantShell";
import { api } from "@/lib/api";
import type { UserDto, ApiError } from "@/types";
import { toast } from "sonner";

export default function UsersPage() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UserDto[]>("/api/users")
      .then(setUsers)
      .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TenantShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Users</h1>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
            + Invite User
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
