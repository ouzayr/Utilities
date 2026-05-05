"use client";

import { useState } from "react";
import { toast } from "sonner";
import TierGate from "@/components/subscription/TierGate";
import type { SubscriptionTier } from "@/types";

interface ExportBarProps {
  cardId?: string;
  cardName?: string;
  currentTier: SubscriptionTier;
  onExportPng: () => Promise<void>;
  onExportPdf: () => Promise<void>;
  onExportVcf: () => Promise<void>;
}

export default function ExportBar({
  cardName = "business-card",
  currentTier,
  onExportPng,
  onExportPdf,
  onExportVcf,
}: ExportBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setLoading(label);
    try {
      await fn();
      toast.success(`${label} exported`);
    } catch (e) {
      toast.error(`${label} export failed`);
      console.error(e);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card border rounded-lg">
      <span className="text-sm font-medium text-muted-foreground mr-2">Export:</span>

      <button
        onClick={() => run("VCF", onExportVcf)}
        disabled={loading !== null}
        className="px-4 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading === "VCF" ? "…" : "VCF (Contact)"}
      </button>

      <TierGate currentTier={currentTier} requiredTier="Professional">
        <button
          onClick={() => run("PNG", onExportPng)}
          disabled={loading !== null}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === "PNG" ? "…" : "PNG"}
        </button>
      </TierGate>

      <TierGate currentTier={currentTier} requiredTier="Professional">
        <button
          onClick={() => run("PDF", onExportPdf)}
          disabled={loading !== null}
          className="px-4 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {loading === "PDF" ? "…" : "PDF"}
        </button>
      </TierGate>
    </div>
  );
}
