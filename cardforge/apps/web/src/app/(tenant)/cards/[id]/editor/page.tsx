"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import TenantShell from "@/components/layout/TenantShell";
import FabricCanvas, { serializeCanvas } from "@/components/editor/FabricCanvas";
import Toolbar from "@/components/editor/Toolbar";
import ExportBar from "@/components/editor/ExportBar";
import { api } from "@/lib/api";
import { getMe, getStoredAuth } from "@/lib/auth";
import { exportCanvasAsPng, exportCanvasAsPdf, downloadVcf } from "@/lib/exportHelpers";
import type { CardDto, MeResponse, SubscriptionTier, ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function CardEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canvasRef = useRef<import("fabric/fabric-impl").Canvas | null>(null);
  const [card, setCard] = useState<CardDto | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cardName, setCardName] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = id === "new";

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    if (!isNew) {
      api.get<CardDto>(`/api/cards/${id}`)
        .then((c) => { setCard(c); setCardName(c.name); })
        .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load card"));
    } else {
      setCardName("My Card");
    }
  }, [id, isNew]);

  const handleCanvasReady = useCallback((canvas: import("fabric/fabric-impl").Canvas) => {
    canvasRef.current = canvas;
  }, []);

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const fabricJson = serializeCanvas(canvas);
      if (isNew) {
        const created = await api.post<CardDto>("/api/cards", {
          name: cardName,
          templateId: null,
          fabricJson,
          fieldValues: "{}",
        });
        toast.success("Card saved");
        router.replace(`/cards/${created.id}/editor`);
      } else {
        await api.put<CardDto>(`/api/cards/${id}`, {
          name: cardName,
          fabricJson,
          fieldValues: card?.fieldValues ?? "{}",
        });
        toast.success("Card saved");
      }
    } catch (e) {
      toast.error((e as ApiError).detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addText() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = new fabric.IText("Edit me", {
      left: 100, top: 100, fontSize: 24, fill: "#1a1a1a",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
  }

  async function addRect() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 120, top: 120, width: 120, height: 60,
      fill: "#3b82f6", rx: 6, ry: 6,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
  }

  async function addCircle() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const circle = new fabric.Circle({
      left: 150, top: 150, radius: 40, fill: "#10b981",
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
  }

  function bringForward() { canvasRef.current?.bringForward(canvasRef.current.getActiveObject()!); }
  function sendBackward() { canvasRef.current?.sendBackwards(canvasRef.current.getActiveObject()!); }
  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    canvas.remove(...active);
    canvas.discardActiveObject();
  }
  function undo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    if (objs.length > 0) canvas.remove(objs[objs.length - 1]);
  }

  const tier: SubscriptionTier = me?.activeTier ?? "Starter";
  const token = getStoredAuth()?.accessToken ?? "";

  return (
    <TenantShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="text-xl font-bold border-b border-transparent hover:border-border focus:border-primary bg-transparent outline-none flex-1"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <Toolbar
          onAddText={addText}
          onAddRect={addRect}
          onAddCircle={addCircle}
          onBringForward={bringForward}
          onSendBackward={sendBackward}
          onDeleteSelected={deleteSelected}
          onUndo={undo}
        />

        <div className="overflow-x-auto">
          <FabricCanvas
            initialJson={card?.fabricJson}
            onReady={handleCanvasReady}
          />
        </div>

        {!isNew && (
          <ExportBar
            cardId={id}
            cardName={cardName}
            currentTier={tier}
            onExportPng={async () => { if (canvasRef.current) exportCanvasAsPng(canvasRef.current, `${cardName}.png`); }}
            onExportPdf={async () => { if (canvasRef.current) await exportCanvasAsPdf(canvasRef.current, `${cardName}.pdf`); }}
            onExportVcf={async () => { await downloadVcf(id, API_URL, token); }}
          />
        )}
      </div>
    </TenantShell>
  );
}
