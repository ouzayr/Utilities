import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Schema } from "../lib/api";

export default function MetadataPage() {
  const { connectionId, fq } = useParams();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["schema", connectionId],
    enabled: !!connectionId,
    queryFn: async () => (await api.get<Schema>(`/connections/${connectionId}/schema`)).data,
  });

  const bootstrap = useMutation({
    mutationFn: async () => (await api.post(`/connections/${connectionId}/metadata/bootstrap`)).data,
  });

  const active = data?.tables.find((t) => t.fqname === fq);

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-surface-700 overflow-auto scrollbar">
        <div className="p-3 border-b border-surface-700 space-y-2">
          <button
            className="w-full rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs hover:bg-surface-700"
            onClick={() => bootstrap.mutate()}
            disabled={bootstrap.isPending}
          >
            {bootstrap.isPending ? "bootstrapping…" : "bootstrap sqlutil schema"}
          </button>
          <p className="text-[11px] text-slate-400">
            Creates the <code>sqlutil</code> schema + metadata tables in this DB. Safe to re-run.
          </p>
        </div>
        <ul className="text-sm">
          {data?.tables.map((t) => (
            <li key={t.fqname}>
              <Link to={`/c/${connectionId}/metadata/${t.fqname}`}
                className={`block px-3 py-1 hover:bg-surface-800 font-mono text-[12px] ${active?.fqname === t.fqname ? "bg-surface-800" : ""}`}>
                {t.fqname}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 min-w-0 overflow-auto scrollbar p-5">
        {active ? (
          <MetaEditor connectionId={connectionId!} schemaName={active.schema} tableName={active.name}
            onSaved={() => qc.invalidateQueries({ queryKey: ["export", connectionId] })}
            columns={active.columns.map((c) => ({ name: c.name, type: c.type_string }))} />
        ) : (
          <div className="text-slate-400">Pick a table to edit its metadata.</div>
        )}
      </section>
    </div>
  );
}

function MetaEditor({ connectionId, schemaName, tableName, columns, onSaved }: {
  connectionId: string; schemaName: string; tableName: string; columns: { name: string; type: string }[]; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["meta", connectionId, schemaName, tableName],
    queryFn: async () => (await api.get(`/connections/${connectionId}/metadata/tables/${schemaName}/${tableName}`)).data,
  });

  const [desc, setDesc] = useState<string>("");
  const [owner, setOwner] = useState<string>("");
  const [domain, setDomain] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [llmInclude, setLlmInclude] = useState<boolean>(true);

  const saveTable = useMutation({
    mutationFn: async () => (await api.put(
      `/connections/${connectionId}/metadata/tables/${schemaName}/${tableName}`,
      {
        description: desc || null,
        owner: owner || null,
        domain: domain || null,
        llm_include: llmInclude,
        tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      },
    )).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta", connectionId, schemaName, tableName] }); onSaved(); },
  });

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold font-mono">{schemaName}.{tableName}</h2>

      <div className="rounded-lg border border-surface-700 bg-surface-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase text-slate-400">Table metadata</h3>
        <Field label="Description (markdown)">
          <textarea className="input min-h-[80px]" placeholder={data?.table?.description ?? ""}
            value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Owner"><input className="input" placeholder={data?.table?.owner ?? ""} value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
          <Field label="Domain"><input className="input" placeholder={data?.table?.domain ?? ""} value={domain} onChange={(e) => setDomain(e.target.value)} /></Field>
          <Field label="Tags (comma-separated)"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={llmInclude} onChange={(e) => setLlmInclude(e.target.checked)} />
          Include in LLM / docs export
        </label>
        <button className="rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500"
          onClick={() => saveTable.mutate()} disabled={saveTable.isPending}>
          {saveTable.isPending ? "saving…" : "Save"}
        </button>
      </div>

      <div className="rounded-lg border border-surface-700 bg-surface-900 p-4">
        <h3 className="text-sm font-semibold uppercase text-slate-400 mb-2">Columns</h3>
        <ColumnMetaTable connectionId={connectionId} schemaName={schemaName} tableName={tableName}
          columns={columns} existing={data?.columns ?? []} />
      </div>

      <style>{`
        .input { @apply w-full rounded-md border border-surface-700 bg-surface-800 px-2 py-1.5 text-sm; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function ColumnMetaTable({ connectionId, schemaName, tableName, columns, existing }: {
  connectionId: string; schemaName: string; tableName: string; columns: { name: string; type: string }[]; existing: any[];
}) {
  const qc = useQueryClient();
  const existingByName = new Map<string, any>(existing.map((r) => [r.column_name, r]));
  const [edits, setEdits] = useState<Record<string, any>>({});

  const save = useMutation({
    mutationFn: async (column: string) => (
      await api.put(
        `/connections/${connectionId}/metadata/tables/${schemaName}/${tableName}/columns/${column}`,
        edits[column] ?? {},
      )
    ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", connectionId, schemaName, tableName] }),
  });

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-slate-400">
        <tr>
          <th className="p-2">Column</th>
          <th className="p-2">Type</th>
          <th className="p-2">Description</th>
          <th className="p-2">Sensitivity</th>
          <th className="p-2">LLM</th>
          <th className="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {columns.map((c) => {
          const cur = existingByName.get(c.name) ?? {};
          const edit = edits[c.name] ?? {};
          const desc = edit.description ?? cur.description ?? "";
          const sens = edit.sensitivity ?? cur.sensitivity ?? "";
          const llm = edit.llm_include ?? (cur.llm_include ?? 1) === 1;
          return (
            <tr key={c.name} className="border-t border-surface-700">
              <td className="p-2 font-mono text-xs">{c.name}</td>
              <td className="p-2 font-mono text-xs text-slate-400">{c.type}</td>
              <td className="p-2"><input className="w-full rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs" value={desc}
                onChange={(e) => setEdits((p) => ({ ...p, [c.name]: { ...p[c.name], description: e.target.value } }))} /></td>
              <td className="p-2">
                <select className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs"
                  value={sens}
                  onChange={(e) => setEdits((p) => ({ ...p, [c.name]: { ...p[c.name], sensitivity: e.target.value || null } }))}>
                  <option value="">—</option>
                  <option value="public">public</option>
                  <option value="internal">internal</option>
                  <option value="confidential">confidential</option>
                  <option value="pii">pii</option>
                  <option value="secret">secret</option>
                </select>
              </td>
              <td className="p-2">
                <input type="checkbox" checked={llm}
                  onChange={(e) => setEdits((p) => ({ ...p, [c.name]: { ...p[c.name], llm_include: e.target.checked } }))} />
              </td>
              <td className="p-2">
                <button className="rounded bg-surface-800 px-2 py-1 text-xs hover:bg-surface-700"
                  onClick={() => save.mutate(c.name)}>save</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
