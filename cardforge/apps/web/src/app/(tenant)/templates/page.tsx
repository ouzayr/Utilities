"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TenantShell from "@/components/layout/TenantShell";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import type { TemplateDto, MeResponse, ApiError } from "@/types";
import { toast } from "sonner";

function canManageTemplates(me: MeResponse): boolean {
  const policy = me.templateCreationPolicy;
  const role = me.role;
  if (role === "SuperAdmin") return true;
  if (policy === "PlatformAdminOnly") return false;
  if (policy === "ClientAdminOnly") return role === "ClientAdmin";
  if (policy === "TemplateManagerOrAbove") return role === "ClientAdmin" || role === "TemplateManager";
  return true;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<TemplateDto[]>("/api/templates"),
      getMe(),
    ])
      .then(([t, m]) => { setTemplates(t); setMe(m); })
      .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const showNewButton = me && canManageTemplates(me);

  return (
    <TenantShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Templates</h1>
          {showNewButton && (
            <Link href="/templates/new/editor"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
              + New Template
            </Link>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No templates yet</p>
            <p className="text-sm mt-1">
              {showNewButton ? "Create your first template to get started." : "Contact your admin to create templates."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="bg-card border rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <p className="font-medium">{t.name}</p>
                  {t.isPublished && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Published</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(t.updatedAt).toLocaleDateString()}
                </p>
                {showNewButton && (
                  <Link href={`/templates/${t.id}/editor`}
                    className="block text-center border rounded-md py-1.5 text-sm hover:bg-accent transition-colors">
                    Edit
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </TenantShell>
  );
}
