import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Play } from "lucide-react";

export default function QueryPage() {
  const { connectionId } = useParams();
  const [sql, setSql] = useState<string>("SELECT TOP 50 * FROM sys.tables");

  const run = useMutation({
    mutationFn: async () => (await api.post(`/connections/${connectionId}/query/run`, { sql, max_rows: 200 })).data,
  });

  const rows: Record<string, unknown>[] = run.data?.rows ?? [];
  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="p-5 space-y-3">
      <h2 className="text-xl font-semibold">Query (read-only)</h2>
      <textarea
        className="w-full min-h-[120px] rounded-md border border-surface-700 bg-surface-800 p-2 font-mono text-sm"
        value={sql} onChange={(e) => setSql(e.target.value)}
      />
      <div>
        <button onClick={() => run.mutate()} disabled={run.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500">
          <Play size={14} /> {run.isPending ? "running…" : "Run"}
        </button>
        {run.isError && <span className="ml-3 text-xs text-red-400">{(run.error as any)?.response?.data?.detail ?? (run.error as any).message}</span>}
      </div>
      {run.data && (
        <div className="rounded-lg border border-surface-700 overflow-auto scrollbar">
          <table className="w-full text-xs">
            <thead className="bg-surface-800 text-left text-[11px] uppercase text-slate-400">
              <tr>{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-surface-700">
                  {cols.map((c) => <td key={c} className="p-2 font-mono">{String(r[c] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
