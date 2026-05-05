import type { Canvas } from "fabric/fabric-impl";

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function exportCanvasAsPng(canvas: Canvas, filename = "business-card.png") {
  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 3 });
  downloadDataUrl(dataUrl, filename);
}

export async function exportCanvasAsPdf(canvas: Canvas, filename = "business-card.pdf") {
  const { jsPDF } = await import("jspdf");
  const CARD_W_IN = 3.5;
  const CARD_H_IN = 2;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "in",
    format: [CARD_W_IN, CARD_H_IN],
  });

  const imgData = canvas.toDataURL({ format: "png", multiplier: 3 });
  doc.addImage(imgData, "PNG", 0, 0, CARD_W_IN, CARD_H_IN);
  doc.save(filename);
}

export async function downloadVcf(cardId: string, apiUrl: string, token: string) {
  const res = await fetch(`${apiUrl}/api/export/cards/${cardId}/vcf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Failed to generate VCF");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const fileName = match?.[1] ?? "contact.vcf";
  downloadDataUrl(url, fileName);
  URL.revokeObjectURL(url);
}
