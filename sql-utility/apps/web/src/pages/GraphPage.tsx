import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { api, Graph } from "../lib/api";
import { Key } from "lucide-react";

type NodeData = {
  label: string;
  row_count: number;
  selected: boolean;
  dimmed: boolean;
  has_primary_key: boolean;
  kind: "table" | "view";
};

function TableNode({ data }: NodeProps<NodeData>) {
  const borderColor = data.selected
    ? "#38bdf8"
    : data.dimmed
    ? "#1c2230"
    : "#334155";
  const bg = data.dimmed ? "#0f131a" : "#141924";
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs font-mono shadow-sm"
      style={{ borderColor, background: bg, minWidth: 160, opacity: data.dimmed ? 0.45 : 1 }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1">
        {data.has_primary_key && <Key size={10} className="text-amber-400" />}
        <span>{data.label}</span>
        {data.kind === "view" && <span className="ml-1 text-slate-500">(view)</span>}
      </div>
      <div className="text-[10px] text-slate-500">{data.row_count.toLocaleString()} rows</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { table: TableNode };

function layout(graph: Graph): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const bySchema = new Map<string, typeof graph.nodes>();
  for (const n of graph.nodes) {
    if (!bySchema.has(n.schema)) bySchema.set(n.schema, []);
    bySchema.get(n.schema)!.push(n);
  }
  let col = 0;
  for (const [, ns] of bySchema) {
    ns.sort((a, b) => a.name.localeCompare(b.name));
    ns.forEach((n, i) => {
      nodes.push({
        id: n.id,
        type: "table",
        position: { x: col * 260, y: i * 90 },
        data: {
          label: n.name,
          row_count: n.row_count,
          selected: false,
          dimmed: false,
          has_primary_key: n.has_primary_key,
          kind: n.kind,
        },
      });
    });
    col += 1;
  }
  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.columns.join(", "),
    labelStyle: { fontSize: 9, fill: "#94a3b8" },
    style: { stroke: "#475569", strokeWidth: 1 },
    type: "smoothstep",
    animated: false,
  }));
  return { nodes, edges };
}

export default function GraphPage() {
  const { connectionId } = useParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [depth, setDepth] = useState(1);
  const [direction, setDirection] = useState<"both" | "in" | "out">("both");
  const [includeRoutines, setIncludeRoutines] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["graph", connectionId, includeRoutines],
    enabled: !!connectionId,
    queryFn: async () =>
      (await api.get<Graph>(`/connections/${connectionId}/graph`, { params: { include_routines: includeRoutines } })).data,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data) return;
    const { nodes: ns, edges: es } = layout(data);
    setNodes(ns);
    setEdges(es);
  }, [data, setNodes, setEdges]);

  const highlighted = useMemo(() => {
    if (!data || selected.size === 0) return null;
    const nodeSet = new Set<string>(selected);
    const edgeSet = new Set<string>();
    let frontier = new Set<string>(selected);
    for (let d = 0; d < depth; d++) {
      const next = new Set<string>();
      for (const e of data.edges) {
        if ((direction === "out" || direction === "both") && frontier.has(e.source)) {
          edgeSet.add(e.id);
          if (!nodeSet.has(e.target)) next.add(e.target);
        }
        if ((direction === "in" || direction === "both") && frontier.has(e.target)) {
          edgeSet.add(e.id);
          if (!nodeSet.has(e.source)) next.add(e.source);
        }
      }
      for (const id of next) nodeSet.add(id);
      if (next.size === 0) break;
      frontier = next;
    }
    return { nodes: nodeSet, edges: edgeSet };
  }, [data, selected, depth, direction]);

  useEffect(() => {
    if (!highlighted) {
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, dimmed: false, selected: false } })));
      setEdges((es) => es.map((e) => ({ ...e, style: { ...(e.style || {}), stroke: "#475569", strokeWidth: 1 } })));
      return;
    }
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        data: {
          ...n.data,
          selected: selected.has(n.id),
          dimmed: !highlighted.nodes.has(n.id),
        },
      }))
    );
    setEdges((es) =>
      es.map((e) => ({
        ...e,
        style: {
          ...(e.style || {}),
          stroke: highlighted.edges.has(e.id) ? "#38bdf8" : "#1f2937",
          strokeWidth: highlighted.edges.has(e.id) ? 2 : 1,
        },
      }))
    );
  }, [highlighted, selected, setNodes, setEdges]);

  const onNodeClick = useCallback((_: unknown, node: Node<NodeData>) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-surface-700 p-3 space-y-3">
        <div>
          <div className="mb-1 text-xs uppercase text-slate-400">Depth</div>
          <input type="range" min={1} max={5} value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full" />
          <div className="text-xs text-slate-400">{depth} hop{depth !== 1 ? "s" : ""}</div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase text-slate-400">Direction</div>
          <select value={direction} onChange={(e) => setDirection(e.target.value as any)}
            className="w-full rounded-md border border-surface-700 bg-surface-800 px-2 py-1 text-sm">
            <option value="both">both (neighbors)</option>
            <option value="out">out (dependencies)</option>
            <option value="in">in (dependents)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeRoutines} onChange={(e) => setIncludeRoutines(e.target.checked)} />
          Include views / procs
        </label>

        <div>
          <div className="mb-1 text-xs uppercase text-slate-400">Selected ({selected.size})</div>
          {selected.size === 0 ? (
            <div className="text-xs text-slate-400">Click nodes to highlight.</div>
          ) : (
            <ul className="text-xs font-mono space-y-1 max-h-64 overflow-auto scrollbar">
              {[...selected].map((id) => (
                <li key={id} className="flex items-center justify-between">
                  <span>{id}</span>
                  <button
                    className="text-slate-400 hover:text-red-400"
                    onClick={() => setSelected((prev) => {
                      const n = new Set(prev); n.delete(id); return n;
                    })}
                  >×</button>
                </li>
              ))}
            </ul>
          )}
          {selected.size > 0 && (
            <button className="mt-2 text-xs text-slate-400 hover:text-white"
              onClick={() => setSelected(new Set())}>clear all</button>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-400">loading graph…</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <MiniMap pannable zoomable maskColor="rgba(11, 14, 20, 0.6)" nodeColor="#1c2230" />
            <Controls />
            <Background color="#1c2230" gap={16} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
