"use client";

import { useEffect, useRef, useCallback } from "react";
import { CARD_WIDTH_PX, CARD_HEIGHT_PX, serializeCanvas, loadCanvasFromJson } from "@/lib/fabricHelpers";

interface FabricCanvasProps {
  initialJson?: string;
  onReady?: (canvas: import("fabric/fabric-impl").Canvas) => void;
}

export default function FabricCanvas({ initialJson, onReady }: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<import("fabric/fabric-impl").Canvas | null>(null);

  const init = useCallback(async () => {
    if (!canvasRef.current || fabricRef.current) return;

    const { fabric } = await import("fabric");

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    if (initialJson && initialJson !== "{}") {
      await loadCanvasFromJson(canvas, initialJson);
    }

    onReady?.(canvas);
  }, [initialJson, onReady]);

  useEffect(() => {
    init();
    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [init]);

  return (
    <div
      className="border rounded-lg overflow-hidden shadow-inner bg-white"
      style={{ width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX, maxWidth: "100%" }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

export { serializeCanvas };
