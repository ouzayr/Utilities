import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Connection } from "../lib/api";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Info, Plug, Trash2, X } from "lucide-react";

type ErrorDetail = {
  kind: string;
  summary: string;
  hint: string;
  raw: string;
};

function parseError(e: any): ErrorDetail | string {
  const detail = e?.response?.data?.detail;
  if (detail && typeof detail === "object" && "summary" in detail) {
    return detail as ErrorDetail;
  }
  if (typeof detail === "string") return detail;
  return e?.message ?? "Unknown error";
}

function ErrorCard({ err }: { err: ErrorDetail | string }) {
  if (typeof err === "string") {
    return (
      <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
        {err}
      </div>
    );
  }
  return (
    <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200 space-y-2">
      <div className="flex items-center gap-2 font-medium text-red-100">
        <AlertTriangle size={14} />
        <span>{err.summary}</span>
        <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px]">{err.kind}</span>
      </div>
      <div className="flex items-start gap-2">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>{err.hint}</span>
      </div>
      <details className="opacity-80">
        <summary className="cursor-pointer">raw driver message</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">{err.raw}</pre>
      </details>
    </div>
  );
}

type OdbcHealth = {
  drivers: string[];
  preferred_driver_present: boolean;
  has_v17: boolean;
  has_v18: boolean;
  error: string | null;
};

type SetupHealth = {
  data_dir: string;
  data_dir_writable: boolean;
  data_dir_error: string | null;
  encryption_env_set: boolean;
  encryption_key_file_present: boolean;
  app_db_path: string | null;
  hint: string | null;
};

type AuthMode = "sql" | "windows";

type FormState = {
  name: string;
  host: string;
  port: number | "";
  instance: string;
  database: string;
  auth_mode: AuthMode;
  username: string;
  password: string;
  trust_server_certificate: boolean;
  encrypt: boolean;
  extra_params: string;
};

const EMPTY: FormState = {
  name: "",
  host: "localhost",
  port: 1433,
  instance: "",
  database: "",
  auth_mode: "sql",
  username: "",
  password: "",
  trust_server_certificate: true,
  encrypt: true,
  extra_params: "",
};

type Preset = { label: string; apply: (f: FormState) => FormState };

const PRESETS: Preset[] = [
  {
    label: "Local SQL Express (Windows auth)",
    apply: (f) => ({
      ...f,
      host: "localhost",
      port: "",
      instance: "SQLEXPRESS",
      auth_mode: "windows",
      username: "",
      password: "",
    }),
  },
  {
    label: "Local SQL Express (SQL auth)",
    apply: (f) => ({
      ...f,
      host: "localhost",
      port: "",
      instance: "SQLEXPRESS",
      auth_mode: "sql",
    }),
  },
  {
    label: "Default TCP 1433 (SQL auth)",
    apply: (f) => ({
      ...f,
      host: "localhost",
      port: 1433,
      instance: "",
      auth_mode: "sql",
    }),
  },
];

function buildPayload(f: FormState) {
  return {
    name: f.name,
    host: f.host,
    port: f.port === "" ? null : Number(f.port),
    instance: f.instance || null,
    database: f.database,
    auth_mode: f.auth_mode,
    username: f.auth_mode === "windows" ? null : f.username,
    password: f.auth_mode === "windows" ? null : f.password,
    trust_server_certificate: f.trust_server_certificate,
    encrypt: f.encrypt,
    extra_params: f.extra_params || null,
  };
}

export default function Connections() {
  const qc = useQueryClient();
  const { data: conns, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => (await api.get<Connection[]>("/connections")).data,
  });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: true; msg: string } | { ok: false; err: ErrorDetail | string } | null>(null);
  const [formError, setFormError] = useState<ErrorDetail | string | null>(null);

  const odbc = useQuery({
    queryKey: ["health-odbc"],
    queryFn: async () => (await api.get<OdbcHealth>("/health/odbc")).data,
  });
  const setup = useQuery({
    queryKey: ["health-setup"],
    queryFn: async () => (await api.get<SetupHealth>("/health/setup")).data,
  });

  const create = useMutation({
    mutationFn: async (f: FormState) => (await api.post<Connection>("/connections", buildPayload(f))).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      setForm(EMPTY);
      setShowForm(false);
      setFormError(null);
    },
    onError: (e: any) => setFormError(parseError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
  const test = useMutation({
    mutationFn: async (id: string) => (await api.post(`/connections/${id}/test`)).data,
    onSuccess: (r: any) => setTestResult({ ok: true, msg: JSON.stringify(r) }),
    onError: (e: any) => setTestResult({ ok: false, err: parseError(e) }),
  });

  const isWindowsAuth = form.auth_mode === "windows";

  const odbcWarning =
    odbc.data &&
    !odbc.data.preferred_driver_present &&
    "ODBC Driver 18 for SQL Server not detected on the API host. Install it before saving a connection (see README).";
  const setupWarning =
    setup.data && !setup.data.data_dir_writable
      ? `Data directory ${setup.data.data_dir} is not writable — ${setup.data.data_dir_error ?? ""}`
      : null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connections</h2>
        <button
          onClick={() => {
            setShowForm((s) => !s);
            setFormError(null);
          }}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium hover:bg-accent-500"
        >
          {showForm ? "Cancel" : "New connection"}
        </button>
      </div>

      {(odbcWarning || setupWarning) && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/40 p-3 text-xs text-amber-200 space-y-1">
          {odbcWarning && <div className="flex items-start gap-2"><AlertTriangle size={14} /> <span>{odbcWarning}</span></div>}
          {setupWarning && <div className="flex items-start gap-2"><AlertTriangle size={14} /> <span>{setupWarning}</span></div>}
          {odbc.data?.drivers && odbc.data.drivers.length > 0 && (
            <div className="font-mono text-[10px] opacity-70">detected: {odbc.data.drivers.join(", ")}</div>
          )}
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-surface-700 bg-surface-900 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setForm((f) => p.apply(f))}
                className="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-xs hover:border-accent-500"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Database">
              <input className="input" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
            </Field>
            <Field label="Host">
              <input className="input" placeholder="localhost" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </Field>
            <Field label="Instance (optional, e.g. SQLEXPRESS)">
              <input className="input" placeholder="SQLEXPRESS" value={form.instance} onChange={(e) => setForm({ ...form, instance: e.target.value })} />
            </Field>
            <Field label="Port (blank = use SQL Browser for named instance)">
              <input
                type="number"
                className="input"
                placeholder="1433"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </Field>
            <Field label="Auth mode">
              <select
                className="input"
                value={form.auth_mode}
                onChange={(e) => setForm({ ...form, auth_mode: e.target.value as AuthMode })}
              >
                <option value="sql">SQL login</option>
                <option value="windows">Windows (Trusted_Connection)</option>
              </select>
            </Field>
            <Field label="Username">
              <input
                className="input"
                disabled={isWindowsAuth}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className="input"
                disabled={isWindowsAuth}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Encrypt">
              <Toggle value={form.encrypt} onChange={(v) => setForm({ ...form, encrypt: v })} />
            </Field>
            <Field label="Trust server cert">
              <Toggle value={form.trust_server_certificate} onChange={(v) => setForm({ ...form, trust_server_certificate: v })} />
            </Field>
            <Field label="Extra ODBC params (optional)">
              <input
                className="input col-span-2"
                placeholder="e.g. MultiSubnetFailover=yes"
                value={form.extra_params}
                onChange={(e) => setForm({ ...form, extra_params: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => create.mutate(form)}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm hover:bg-accent-500"
                disabled={create.isPending}
              >
                {create.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {formError && <ErrorCard err={formError} />}
            {isWindowsAuth && (
              <div className="text-xs text-slate-400">
                Windows auth requires the API process to run on Windows as a user with access to the SQL Server.
                On Linux/macOS pick SQL login instead.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Server</th>
              <th className="p-2">Database</th>
              <th className="p-2">Auth</th>
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
                  <td className="p-2 font-mono text-xs">
                    {c.host}
                    {c.instance ? `\\${c.instance}` : ""}
                    {c.port ? `,${c.port}` : ""}
                  </td>
                  <td className="p-2 font-mono text-xs">{c.database}</td>
                  <td className="p-2 font-mono text-xs">
                    {c.auth_mode === "windows" ? "Windows" : c.username}
                  </td>
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
      {testResult && testResult.ok && (
        <div className="rounded-md bg-surface-800 p-2 text-xs flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span className="font-mono break-all">{testResult.msg}</span>
          <button onClick={() => setTestResult(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={12} /></button>
        </div>
      )}
      {testResult && !testResult.ok && <ErrorCard err={testResult.err} />}

      <style>{`
        .input { @apply rounded-md border border-surface-700 bg-surface-800 px-2 py-1.5 text-sm w-full; }
        .input:disabled { @apply opacity-50 cursor-not-allowed; }
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
