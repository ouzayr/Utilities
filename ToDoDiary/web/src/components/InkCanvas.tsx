import { useEffect, useRef } from 'react';
import { parseInk } from '../types';

/**
 * Read-only renderer for the portable ink format. Handwriting is written on
 * the phone; the web renders it faithfully (pressure-scaled segment widths).
 */
export function InkCanvas({
  inkJson,
  maxHeight = 480,
  className,
}: {
  inkJson: string | null;
  maxHeight?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const doc = parseInk(inkJson);
    const cssWidth = wrap.clientWidth || 600;
    const dpr = window.devicePixelRatio || 1;

    if (!doc || doc.cw <= 0) {
      canvas.width = cssWidth * dpr;
      canvas.height = 1;
      canvas.style.height = '0px';
      return;
    }

    const scale = cssWidth / doc.cw;
    let maxY = 0;
    for (const s of doc.strokes) {
      for (let i = 1; i < s.p.length; i += 3) {
        if (s.p[i] > maxY) maxY = s.p[i];
      }
    }
    const cssHeight = Math.min(maxHeight, Math.max(24, maxY * scale + 12));

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const s of doc.strokes) {
      ctx.strokeStyle = s.c || '#1A237E';
      const n = Math.floor(s.p.length / 3);
      if (n === 1) {
        ctx.beginPath();
        ctx.lineWidth = s.w * scale;
        ctx.moveTo(s.p[0] * scale, s.p[1] * scale);
        ctx.lineTo(s.p[0] * scale + 0.1, s.p[1] * scale);
        ctx.stroke();
        continue;
      }
      for (let i = 0; i < n - 1; i++) {
        const p1 = (s.p[i * 3 + 2] + s.p[(i + 1) * 3 + 2]) / 2;
        ctx.beginPath();
        ctx.lineWidth = Math.max(0.4, s.w * scale * (0.35 + 0.85 * p1));
        ctx.moveTo(s.p[i * 3] * scale, s.p[i * 3 + 1] * scale);
        ctx.lineTo(s.p[(i + 1) * 3] * scale, s.p[(i + 1) * 3 + 1] * scale);
        ctx.stroke();
      }
    }
  }, [inkJson, maxHeight]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} />
    </div>
  );
}
