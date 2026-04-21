import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, CheckResult } from "../lib/api";
import { Play, Copy } from "lucide-react";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
const SEV_COLORS: Record<string, string> = {
  critical: "bg-rose-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-slate-500 text-white",
};

export default function ChecksPage() {
  const { connectionId } = useParams();
  const { data: rules } = useQuery({
    queryKey: ["rules", connectionId],
    enabled: !!connectionId,
    queryFn: async () => (await api.get(`/connections/${connectionId}/checks`)).data,
  });
  const run = useMutation({
    mutationFn: async () => (await api.post(`/connections/${connectionId}/checks/run`)).data,
  });
  const [filter, setFilter] = useState<string>("all");

  const results: CheckResult[] = run.data?.results ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? results : results.filter((r) => r.severity === filter)).sort(
      (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
    ),
    [results, filter],
  );

  const summary = run.data?.summary ?? {};
  return (
    <div className="p-5 space-y-4">
      <header className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Health checks</h2>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500"
          onClick={() => run.mutate()}
          disabled={run.isPending}
        >
          <Play size={14} /> {run.isPending ? "running…" : "Run checks"}
        </button>
        <div className="ml-auto text-sm text-slate-400">
          {rules ? `${rules.length} rules registered` : "…"}
        </div>
      </header>

      {run.data && (
        <div className="flex flex-wrap gap-2">
          <SevChip label="all" count={results.length} active={filter === "all"} onClick={() => setFilter("all")} />
          {(["critical", "high", "medium", "low", "info"] as const).map((s) => (
            <SevChip
              key={s}
              label={s}
              count={summary[s] ?? 0}
              color={SEV_COLORS[s]}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          ))}
        </div>
      )}

      {!run.data ? (
        <p className="text-sm text-slate-400">Click “Run checks” to scan this database. ~20 rules cover indexing, schema hygiene, and likely PII.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <div key={`${r.rule_id}-${i}`} className="rounded-lg border border-surface-700 bg-surface-900 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] uppercase ${SEV_COLORS[r.severity]}`}>{r.severity}</span>
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="ml-auto text-xs text-slate-500 font-mono">{r.rule_id}</span>
              </div>
              {r.table && (
                <div className="mt-1 text-xs font-mono text-slate-400">
                  {r.table}{r.column ? `.${r.column}` : ""}
                </div>
              )}
              <p className="mt-1 text-sm text-slate-300">{r.description}</p>
              {r.remediation_sql && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>remediation</span>
                    <button className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                      onClick={() => navigator.clipboard.writeText(r.remediation_sql!)}>
                      <Copy size={12} /> copy
                    </button>
                  </div>
                  <pre className="mt-1 rounded bg-surface-800 p-2 text-xs overflow-auto scrollbar">{r.remediation_sql}</pre>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-sm text-slate-400">No issues at this severity.</div>}
        </div>
      )}
    </div>
  );
}

function SevChip({ label, count, color, active, onClick }: { label: string; count: number; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5 border ${active ? "border-accent-500 bg-surface-800" : "border-surface-700 bg-surface-900"}`}
    >
      <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] px-1 ${color ?? "bg-slate-600 text-white"}`}>{count}</span>
      <span className="capitalize">{label}</span>
    </button>
  );
}
