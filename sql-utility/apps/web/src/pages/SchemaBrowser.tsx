import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, Schema, SchemaTable } from "../lib/api";
import { ChevronRight, Eye, Key, Link2, Search, Table2 } from "lucide-react";

export default function SchemaBrowser() {
  const { connectionId, fq } = useParams();
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["schema", connectionId],
    enabled: !!connectionId,
    queryFn: async () => (await api.get<Schema>(`/connections/${connectionId}/schema`)).data,
  });

  const tables = data?.tables ?? [];
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tables;
    return tables.filter((t) => t.fqname.toLowerCase().includes(qq));
  }, [tables, q]);

  const active = tables.find((t) => t.fqname === fq) ?? tables[0];

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-surface-700 overflow-auto scrollbar">
        <div className="p-3">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search tables…"
              className="w-full rounded-md border border-surface-700 bg-surface-800 pl-7 pr-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {isLoading && <div className="p-3 text-sm text-slate-400">loading schema…</div>}
        {error && <div className="p-3 text-sm text-red-400">{(error as any).message}</div>}
        <ul className="text-sm">
          {filtered.map((t) => (
            <li key={t.fqname}>
              <Link
                to={`/c/${connectionId}/schema/${t.fqname}`}
                className={`flex items-center gap-1 px-3 py-1 hover:bg-surface-800 ${
                  active?.fqname === t.fqname ? "bg-surface-800" : ""
                }`}
              >
                {t.is_view ? <Eye size={13} className="text-slate-400" /> : <Table2 size={13} className="text-accent-400" />}
                <span className="font-mono text-[12px]">{t.fqname}</span>
                <span className="ml-auto text-[10px] text-slate-500">{t.row_count?.toLocaleString() ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 min-w-0 overflow-auto scrollbar p-5">
        {!active ? (
          <div className="text-slate-400">Select a table.</div>
        ) : (
          <TableDetails t={active} />
        )}
      </section>
    </div>
  );
}

function TableDetails({ t }: { t: SchemaTable }) {
  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2">
          {t.is_view ? <Eye size={18} /> : <Table2 size={18} />}
          <h2 className="text-xl font-semibold font-mono">{t.fqname}</h2>
        </div>
        <div className="mt-1 text-xs text-slate-400 flex gap-4">
          <span>{t.row_count.toLocaleString()} rows</span>
          <span>{Math.round(t.reserved_kb / 1024)} MB reserved</span>
          <span>{t.columns.length} columns</span>
          <span>{t.indexes.length} indexes</span>
        </div>
        {t.description && <p className="mt-2 text-sm text-slate-300">{t.description}</p>}
      </header>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">Columns</h3>
        <div className="overflow-hidden rounded-lg border border-surface-700">
          <table className="w-full text-sm">
            <thead className="bg-surface-800 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Null</th>
                <th className="p-2">Default</th>
                <th className="p-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {t.columns.map((c) => {
                const isPK = t.primary_key?.columns.includes(c.name);
                const isFK = t.foreign_keys.some((fk) => fk.columns.includes(c.name));
                return (
                  <tr key={c.name} className="border-t border-surface-700">
                    <td className="p-2 text-slate-500">{c.ordinal}</td>
                    <td className="p-2 font-mono flex items-center gap-1">
                      {isPK && <Key size={12} className="text-amber-400" />}
                      {isFK && <Link2 size={12} className="text-cyan-400" />}
                      {c.name}
                    </td>
                    <td className="p-2 font-mono text-xs">{c.type_string}</td>
                    <td className="p-2 text-xs">{c.is_nullable ? "yes" : "no"}</td>
                    <td className="p-2 font-mono text-xs text-slate-400">{c.default_definition ?? ""}</td>
                    <td className="p-2 text-xs text-slate-400">
                      {[c.is_identity && "identity", c.is_computed && "computed"].filter(Boolean).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5">
        <Card title="Primary key">
          {t.primary_key ? (
            <div className="font-mono text-sm">{t.primary_key.columns.join(", ")}</div>
          ) : (
            <div className="text-sm text-amber-400">(none)</div>
          )}
        </Card>
        <Card title="Unique constraints">
          {t.unique_constraints.length === 0 ? (
            <div className="text-sm text-slate-400">none</div>
          ) : (
            <ul className="text-sm font-mono space-y-1">
              {t.unique_constraints.map((u) => (
                <li key={u.name}>{u.name}: ({u.columns.join(", ")})</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Foreign keys">
          {t.foreign_keys.length === 0 ? (
            <div className="text-sm text-slate-400">none</div>
          ) : (
            <ul className="text-sm font-mono space-y-1">
              {t.foreign_keys.map((fk) => (
                <li key={fk.name}>
                  ({fk.columns.join(", ")}) <ChevronRight size={12} className="inline" /> {fk.ref_fqname} ({fk.ref_columns.join(", ")})
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Indexes">
          {t.indexes.length === 0 ? (
            <div className="text-sm text-slate-400">none</div>
          ) : (
            <ul className="text-sm font-mono space-y-1">
              {t.indexes.map((i) => (
                <li key={i.name}>
                  {i.name} <span className="text-slate-500">[{i.type_desc}]</span> ({i.key_columns.join(", ")})
                  {i.included_columns.length ? ` INCLUDE (${i.included_columns.join(", ")})` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-900 p-4">
      <div className="mb-2 text-xs uppercase text-slate-400">{title}</div>
      {children}
    </div>
  );
}
