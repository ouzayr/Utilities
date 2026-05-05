"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import TenantShell from "@/components/layout/TenantShell";
import FabricCanvas, { serializeCanvas } from "@/components/editor/FabricCanvas";
import Toolbar from "@/components/editor/Toolbar";
import { api } from "@/lib/api";
import type { TemplateDto, ApiError } from "@/types";

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canvasRef = useRef<import("fabric/fabric-impl").Canvas | null>(null);
  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [templateName, setTemplateName] = useState("New Template");
  const [saving, setSaving] = useState(false);
  const isNew = id === "new";

  useEffect(() => {
    if (!isNew) {
      api.get<TemplateDto>(`/api/templates/${id}`)
        .then((t) => { setTemplate(t); setTemplateName(t.name); })
        .catch((e: ApiError) => toast.error(e.detail ?? "Failed to load template"));
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
        const created = await api.post<TemplateDto>("/api/templates", {
          name: templateName,
          fabricJson,
          placeholders: "[]",
        });
        toast.success("Template saved");
        router.replace(`/templates/${created.id}/editor`);
      } else {
        await api.put<TemplateDto>(`/api/templates/${id}`, {
          name: templateName,
          fabricJson,
          placeholders: template?.placeholders ?? "[]",
        });
        toast.success("Template saved");
      }
    } catch (e) {
      toast.error((e as ApiError).detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (isNew) { toast.error("Save the template first"); return; }
    try {
      await api.post(`/api/templates/${id}/publish`);
      toast.success("Template published");
    } catch (e) {
      toast.error((e as ApiError).detail ?? "Publish failed");
    }
  }

  async function addText() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = new fabric.IText("Edit me", { left: 100, top: 100, fontSize: 24 });
    canvas.add(text);
    canvas.setActiveObject(text);
  }

  async function addRect() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({ left: 120, top: 120, width: 120, height: 60, fill: "#3b82f6", rx: 6, ry: 6 });
    canvas.add(rect);
    canvas.setActiveObject(rect);
  }

  async function addCircle() {
    const { fabric } = await import("fabric");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const circle = new fabric.Circle({ left: 150, top: 150, radius: 40, fill: "#10b981" });
    canvas.add(circle);
    canvas.setActiveObject(circle);
  }

  function bringForward() { canvasRef.current?.bringForward(canvasRef.current.getActiveObject()!); }
  function sendBackward() { canvasRef.current?.sendBackwards(canvasRef.current.getActiveObject()!); }
  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.remove(...canvas.getActiveObjects());
    canvas.discardActiveObject();
  }
  function undo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    if (objs.length > 0) canvas.remove(objs[objs.length - 1]);
  }

  return (
    <TenantShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-xl font-bold border-b border-transparent hover:border-border focus:border-primary bg-transparent outline-none flex-1"
          />
          <button onClick={handlePublish} className="border px-4 py-2 rounded-md text-sm hover:bg-accent">
            Publish
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <Toolbar
          onAddText={addText} onAddRect={addRect} onAddCircle={addCircle}
          onBringForward={bringForward} onSendBackward={sendBackward}
          onDeleteSelected={deleteSelected} onUndo={undo}
        />

        <div className="overflow-x-auto">
          <FabricCanvas initialJson={template?.fabricJson} onReady={handleCanvasReady} />
        </div>
      </div>
    </TenantShell>
  );
}
