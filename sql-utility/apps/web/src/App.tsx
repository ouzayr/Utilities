import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Database, GitCompareArrows, Network, ScanSearch, Tags, Waypoints, FileCode, TerminalSquare } from "lucide-react";
import { api, Connection } from "./lib/api";
import Connections from "./pages/Connections";
import SchemaBrowser from "./pages/SchemaBrowser";
import GraphPage from "./pages/GraphPage";
import ErdPage from "./pages/ErdPage";
import ChecksPage from "./pages/ChecksPage";
import MetadataPage from "./pages/MetadataPage";
import DiffPage from "./pages/DiffPage";
import QueryPage from "./pages/QueryPage";

function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: async () => (await api.get<Connection[]>("/connections")).data,
  });
}

function Sidebar() {
  const { connectionId } = useParams();
  const items = connectionId
    ? [
        { to: `/c/${connectionId}/schema`, label: "Schema", icon: Database },
        { to: `/c/${connectionId}/graph`, label: "Graph", icon: Network },
        { to: `/c/${connectionId}/erd`, label: "ERD", icon: Waypoints },
        { to: `/c/${connectionId}/checks`, label: "Health checks", icon: ScanSearch },
        { to: `/c/${connectionId}/metadata`, label: "Metadata", icon: Tags },
        { to: `/c/${connectionId}/query`, label: "Query", icon: TerminalSquare },
        { to: `/diff`, label: "Schema diff", icon: GitCompareArrows },
        { to: `/c/${connectionId}/export`, label: "Export", icon: FileCode },
      ]
    : [{ to: `/diff`, label: "Schema diff", icon: GitCompareArrows }];

  return (
    <aside className="w-56 shrink-0 border-r border-surface-700 bg-surface-900 p-3">
      <div className="flex items-center gap-2 px-2 pb-3">
        <Database size={18} className="text-accent-500" />
        <Link to="/" className="text-lg font-semibold tracking-tight">
          sqlutil
        </Link>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isActive ? "bg-surface-700 text-white" : "text-slate-300 hover:bg-surface-800"
              }`
            }
          >
            <it.icon size={16} />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function ConnectionPicker() {
  const { data } = useConnections();
  const navigate = useNavigate();
  const { connectionId } = useParams();
  const location = useLocation();
  useEffect(() => {
    if (!connectionId && data && data.length > 0 && !location.pathname.startsWith("/diff")) {
      navigate(`/c/${data[0].id}/schema`, { replace: true });
    }
  }, [connectionId, data, navigate, location.pathname]);

  return (
    <select
      value={connectionId ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        const rest = location.pathname.split("/").slice(3).join("/") || "schema";
        navigate(next ? `/c/${next}/${rest}` : "/");
      }}
      className="rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-sm"
    >
      <option value="">— pick a connection —</option>
      {data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.database}@{c.host})
        </option>
      ))}
    </select>
  );
}

function Header() {
  return (
    <header className="flex h-12 items-center gap-4 border-b border-surface-700 bg-surface-900 px-4">
      <ConnectionPicker />
      <div className="ml-auto text-xs text-slate-400">SQL Server utility — local</div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-auto scrollbar">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell><Connections /></Shell>} />
      <Route path="/diff" element={<Shell><DiffPage /></Shell>} />
      <Route path="/c/:connectionId" element={<Shell><Connections /></Shell>} />
      <Route path="/c/:connectionId/schema" element={<Shell><SchemaBrowser /></Shell>} />
      <Route path="/c/:connectionId/schema/:fq" element={<Shell><SchemaBrowser /></Shell>} />
      <Route path="/c/:connectionId/graph" element={<Shell><GraphPage /></Shell>} />
      <Route path="/c/:connectionId/erd" element={<Shell><ErdPage /></Shell>} />
      <Route path="/c/:connectionId/checks" element={<Shell><ChecksPage /></Shell>} />
      <Route path="/c/:connectionId/metadata" element={<Shell><MetadataPage /></Shell>} />
      <Route path="/c/:connectionId/metadata/:fq" element={<Shell><MetadataPage /></Shell>} />
      <Route path="/c/:connectionId/query" element={<Shell><QueryPage /></Shell>} />
      <Route path="/c/:connectionId/export" element={<Shell><ExportPage /></Shell>} />
      <Route path="*" element={<Shell><Connections /></Shell>} />
    </Routes>
  );
}

function ExportPage() {
  const { connectionId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["export", connectionId],
    enabled: !!connectionId,
    queryFn: async () => (await api.get(`/connections/${connectionId}/metadata/export`, { params: { format: "json" } })).data,
  });
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-3">Metadata export (JSON)</h2>
      <p className="text-sm text-slate-400 mb-3">
        Schema-versioned JSON that combines live schema + your metadata. Use this to drive docs, seed an LLM context, or diff over time.
      </p>
      {isLoading ? <div>loading…</div> : (
        <pre className="rounded-md bg-surface-800 p-3 text-xs overflow-auto max-h-[70vh] scrollbar">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
