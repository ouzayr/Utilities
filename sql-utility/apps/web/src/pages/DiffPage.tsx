import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, Connection } from "../lib/api";
import { Copy, GitCompareArrows } from "lucide-react";

type Entry = {
  kind: string;
  op: "added" | "removed" | "changed";
  object: string;
  details: Record<string, unknown>;
  migration_sql: string | null;
};

export default function DiffPage() {
  const { data: conns } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => (await api.get<Connection[]>("/connections")).data,
  });

  const [source, setSource] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const diff = useMutation({
    mutationFn: async () => (await api.post("/diff/schemas", {
      source_connection_id: source, target_connection_id: target, include_routines: true,
    })).data as { summary: Record<string, number>; entries: Entry[]; source: string; target: string },
  });

  const entries = diff.data?.entries ?? [];
  const filtered = useMemo(
    () => kindFilter === "all" ? entries : entries.filter((e) => e.kind === kindFilter),
    [entries, kindFilter],
  );
  const allSql = useMemo(() => entries.filter((e) => e.migration_sql).map((e) => `-- ${e.kind} ${e.op} ${e.object}\n${e.migration_sql}`).join("\n\n"), [entries]);

  return (
    <div className="p-5 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><GitCompareArrows size={18} /> Schema diff</h2>
      <p className="text-sm text-slate-400">Bring <b>target</b> in line with <b>source</b>. Additive migration SQL is generated where safe; destructive changes are left for you to review.</p>
      <div className="grid grid-cols-2 gap-3 max-w-3xl">
        <Select label="Source" value={source} onChange={setSource} conns={conns ?? []} />
        <Select label="Target" value={target} onChange={setTarget} conns={conns ?? []} />
      </div>
      <div>
        <button
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500"
          onClick={() => diff.mutate()}
          disabled={!source || !target || source === target || diff.isPending}
        >
          {diff.isPending ? "diffing…" : "Run diff"}
        </button>
      </div>

      {diff.data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <KindChip label="all" count={entries.length} active={kindFilter === "all"} onClick={() => setKindFilter("all")} />
            {["table", "column", "index", "foreign_key", "primary_key", "unique", "routine"].map((k) => {
              const count = entries.filter((e) => e.kind === k).length;
              return (
                <KindChip key={k} label={k} count={count} active={kindFilter === k} onClick={() => setKindFilter(k)} />
              );
            })}
            {allSql && (
              <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs"
                onClick={() => navigator.clipboard.writeText(allSql)}>
                <Copy size={12} /> copy all SQL
              </button>
            )}
          </div>

          <div className="rounded-lg border border-surface-700">
            <table className="w-full text-sm">
              <thead className="bg-surface-800 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="p-2">Kind</th>
                  <th className="p-2">Op</th>
                  <th className="p-2">Object</th>
                  <th className="p-2">Detail</th>
                  <th className="p-2">Migration SQL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i} className="border-t border-surface-700 align-top">
                    <td className="p-2 text-xs font-mono">{e.kind}</td>
                    <td className="p-2 text-xs"><OpBadge op={e.op} /></td>
                    <td className="p-2 font-mono text-xs">{e.object}</td>
                    <td className="p-2 text-xs text-slate-400">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(e.details, null, 0)}</pre>
                    </td>
                    <td className="p-2 text-xs font-mono">
                      {e.migration_sql ? (
                        <pre className="rounded bg-surface-800 p-2 whitespace-pre-wrap">{e.migration_sql}</pre>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td className="p-4 text-slate-400" colSpan={5}>No differences in this category.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, conns }: { label: string; value: string; onChange: (v: string) => void; conns: Connection[] }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase text-slate-400">{label}</div>
      <select className="w-full rounded-md border border-surface-700 bg-surface-800 px-2 py-1.5 text-sm"
        value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— pick —</option>
        {conns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.database}@{c.host})</option>)}
      </select>
    </label>
  );
}

function OpBadge({ op }: { op: "added" | "removed" | "changed" }) {
  const cls = op === "added" ? "bg-emerald-600" : op === "removed" ? "bg-rose-600" : "bg-amber-500 text-black";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] uppercase ${cls}`}>{op}</span>;
}

function KindChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5 border ${active ? "border-accent-500 bg-surface-800" : "border-surface-700 bg-surface-900"}`}>
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-600 text-white text-[10px] px-1">{count}</span>
      <span>{label}</span>
    </button>
  );
}
