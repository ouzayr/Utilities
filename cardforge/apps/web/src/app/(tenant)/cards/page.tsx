"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TenantShell from "@/components/layout/TenantShell";
import { api } from "@/lib/api";
import type { CardDto, ApiError } from "@/types";
import { toast } from "sonner";

export default function CardsPage() {
  const [cards, setCards] = useState<CardDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CardDto[]>("/api/cards")
      .then(setCards)
      .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load cards"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this card?")) return;
    try {
      await api.delete(`/api/cards/${id}`);
      setCards((prev) => prev.filter((c) => c.id !== id));
      toast.success("Card deleted");
    } catch (e) {
      toast.error((e as ApiError).detail ?? "Delete failed");
    }
  }

  return (
    <TenantShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Cards</h1>
          <Link href="/cards/new/editor"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
            + New Card
          </Link>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No cards yet</p>
            <p className="text-sm mt-1">Create your first business card to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.id} className="bg-card border rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <p className="font-medium">{c.name}</p>
                  {c.isPublished && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Published</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(c.updatedAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2 pt-1">
                  <Link href={`/cards/${c.id}/editor`}
                    className="flex-1 text-center border rounded-md py-1.5 text-sm hover:bg-accent transition-colors">
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex-1 text-center border border-destructive text-destructive rounded-md py-1.5 text-sm hover:bg-destructive/10 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TenantShell>
  );
}
