import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import mermaid from "mermaid";
import { api, Schema } from "../lib/api";
import { Copy, Download } from "lucide-react";

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });

export default function ErdPage() {
  const { connectionId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["schema", connectionId],
    enabled: !!connectionId,
    queryFn: async () => (await api.get<Schema>(`/connections/${connectionId}/schema`)).data,
  });

  const tables = (data?.tables ?? []).filter((t) => !t.is_view);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<"mermaid" | "dbml">("mermaid");
  const [body, setBody] = useState<string>("");
  const [svg, setSvg] = useState<string>("");

  // preselect first 6 tables
  useEffect(() => {
    if (tables.length && selected.size === 0) {
      setSelected(new Set(tables.slice(0, Math.min(6, tables.length)).map((t) => t.fqname)));
    }
  }, [tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedList = useMemo(() => [...selected], [selected]);

  useEffect(() => {
    async function gen() {
      if (!connectionId || selectedList.length === 0) { setBody(""); setSvg(""); return; }
      const params = new URLSearchParams();
      selectedList.forEach((s) => params.append("tables", s));
      const url = `/connections/${connectionId}/erd/${format}?${params.toString()}`;
      const r = await api.get(url);
      setBody(r.data.body);
      if (format === "mermaid") {
        try {
          const { svg } = await mermaid.render(`erd-${Date.now()}`, r.data.body);
          setSvg(svg);
        } catch (e: any) {
          setSvg(`<pre>${String(e?.message ?? e)}</pre>`);
        }
      } else {
        setSvg("");
      }
    }
    gen();
  }, [connectionId, selectedList, format]);

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-surface-700 overflow-auto scrollbar">
        <div className="p-3 space-y-2 sticky top-0 bg-surface-900/80 backdrop-blur border-b border-surface-700">
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setSelected(new Set(tables.map((t) => t.fqname)))}>Select all</button>
            <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Format</label>
            <select className="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs"
              value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="mermaid">Mermaid</option>
              <option value="dbml">DBML</option>
            </select>
          </div>
          <div className="text-[11px] text-slate-500">{selected.size} selected / {tables.length}</div>
        </div>
        <ul className="text-sm">
          {isLoading ? <li className="p-3 text-slate-400 text-sm">loading…</li> : tables.map((t) => {
            const on = selected.has(t.fqname);
            return (
              <li key={t.fqname}>
                <label className="flex items-center gap-2 px-3 py-1 hover:bg-surface-800 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={(e) => {
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(t.fqname); else n.delete(t.fqname);
                      return n;
                    });
                  }} />
                  <span className="font-mono text-[12px]">{t.fqname}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex-1 min-w-0 overflow-auto scrollbar">
        <div className="sticky top-0 flex items-center gap-2 border-b border-surface-700 bg-surface-900 p-3">
          <button className="btn" onClick={() => navigator.clipboard.writeText(body)}>
            <Copy size={13} /> Copy {format}
          </button>
          <button className="btn" onClick={() => download(body, `erd.${format === "mermaid" ? "mmd" : "dbml"}`)}>
            <Download size={13} /> Download
          </button>
          {svg && (
            <button className="btn" onClick={() => download(svg, "erd.svg", "image/svg+xml")}>
              <Download size={13} /> SVG
            </button>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 gap-4">
          {format === "mermaid" && svg ? (
            <div className="rounded-lg border border-surface-700 bg-surface-900 p-2 overflow-auto scrollbar"
                 dangerouslySetInnerHTML={{ __html: svg }} />
          ) : null}
          <pre className="rounded-lg border border-surface-700 bg-surface-900 p-3 text-xs overflow-auto scrollbar">{body}</pre>
        </div>
      </section>

      <style>{`
        .btn { @apply inline-flex items-center gap-1 rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs hover:bg-surface-700; }
      `}</style>
    </div>
  );
}

function download(content: string, filename: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
