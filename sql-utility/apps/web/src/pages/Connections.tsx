import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Connection } from "../lib/api";
import { Link } from "react-router-dom";
import { Check, Plug, Trash2, X } from "lucide-react";

type FormState = {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  trust_server_certificate: boolean;
  encrypt: boolean;
};

const EMPTY: FormState = {
  name: "",
  host: "localhost",
  port: 1433,
  database: "",
  username: "sa",
  password: "",
  trust_server_certificate: true,
  encrypt: true,
};

export default function Connections() {
  const qc = useQueryClient();
  const { data: conns, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => (await api.get<Connection[]>("/connections")).data,
  });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (f: FormState) => (await api.post<Connection>("/connections", f)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      setForm(EMPTY);
      setShowForm(false);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
  const test = useMutation({
    mutationFn: async (id: string) => (await api.post(`/connections/${id}/test`)).data,
    onSuccess: (r) => setTestResult(typeof r === "object" ? JSON.stringify(r) : String(r)),
    onError: (e: any) => setTestResult(`error: ${e?.response?.data?.detail ?? e.message}`),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connections</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium hover:bg-accent-500"
        >
          {showForm ? "Cancel" : "New connection"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-surface-700 bg-surface-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Host">
              <input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </Field>
            <Field label="Port">
              <input type="number" className="input" value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </Field>
            <Field label="Database">
              <input className="input" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
            </Field>
            <Field label="Username">
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Password">
              <input type="password" className="input" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Encrypt">
              <Toggle value={form.encrypt} onChange={(v) => setForm({ ...form, encrypt: v })} />
            </Field>
            <Field label="Trust server cert">
              <Toggle value={form.trust_server_certificate} onChange={(v) => setForm({ ...form, trust_server_certificate: v })} />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => create.mutate(form)}
              className="rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500"
              disabled={create.isPending}
            >
              Save
            </button>
            {create.isError && <span className="text-sm text-red-400">{(create.error as any)?.message}</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Host</th>
              <th className="p-2">Database</th>
              <th className="p-2">User</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="p-2" colSpan={5}>loading…</td></tr>
            ) : conns?.length === 0 ? (
              <tr><td className="p-4 text-slate-400" colSpan={5}>No saved connections. Create one to get started.</td></tr>
            ) : (
              conns?.map((c) => (
                <tr key={c.id} className="border-t border-surface-700">
                  <td className="p-2"><Link to={`/c/${c.id}/schema`} className="text-accent-400 hover:underline">{c.name}</Link></td>
                  <td className="p-2 font-mono text-xs">{c.host}:{c.port}</td>
                  <td className="p-2 font-mono text-xs">{c.database}</td>
                  <td className="p-2 font-mono text-xs">{c.username}</td>
                  <td className="p-2 flex gap-1">
                    <IconBtn title="Test" onClick={() => test.mutate(c.id)}><Plug size={14} /></IconBtn>
                    <IconBtn title="Delete" onClick={() => remove.mutate(c.id)}><Trash2 size={14} /></IconBtn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {testResult && (
        <div className="rounded-md bg-surface-800 p-2 text-xs flex items-center gap-2">
          {testResult.startsWith("error") ? <X size={14} className="text-red-400" /> : <Check size={14} className="text-emerald-400" />}
          <span className="font-mono">{testResult}</span>
        </div>
      )}

      <style>{`
        .input { @apply rounded-md border border-surface-700 bg-surface-800 px-2 py-1.5 text-sm w-full; }
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`h-6 w-11 rounded-full transition-colors ${value ? "bg-accent-600" : "bg-surface-700"}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="rounded p-1 text-slate-300 hover:bg-surface-800">
      {children}
    </button>
  );
}
