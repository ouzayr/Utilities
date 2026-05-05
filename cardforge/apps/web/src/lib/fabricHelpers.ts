import type { Canvas, Object as FabricObject } from "fabric/fabric-impl";

export const CARD_WIDTH_PX = 1050;
export const CARD_HEIGHT_PX = 600;

const CUSTOM_PROPS = ["id", "placeholder", "lockMovementX", "lockMovementY"];

export function serializeCanvas(canvas: Canvas): string {
  return JSON.stringify(canvas.toJSON(CUSTOM_PROPS));
}

export async function loadCanvasFromJson(canvas: Canvas, json: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.loadFromJSON(JSON.parse(json), () => {
      canvas.renderAll();
      resolve();
    });
  });
}

export function bindFieldValues(canvas: Canvas, fieldValues: Record<string, string>) {
  canvas.getObjects().forEach((obj: FabricObject & { placeholder?: string }) => {
    if (obj.placeholder && fieldValues[obj.placeholder] !== undefined) {
      // @ts-expect-error fabric text type
      if (typeof obj.set === "function" && "text" in obj) {
        obj.set("text", fieldValues[obj.placeholder]);
      }
    }
  });
  canvas.renderAll();
}

export function exportAsPng(canvas: Canvas): string {
  return canvas.toDataURL({ format: "png", multiplier: 3 });
}
