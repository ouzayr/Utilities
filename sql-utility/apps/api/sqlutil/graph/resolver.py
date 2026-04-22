"""Dependency graph builder.

Nodes: tables and views (and optionally procs/funcs).
Edges:
  - kind="fk": FK from table A -> referenced table B (directional). Carries the FK name and columns.
  - kind="uses": non-table object (view/proc/function/trigger) -> table it references.
"""

from __future__ import annotations

from ..introspect.schema_model import Schema


def build_graph(
    schema: Schema,
    include_views: bool = True,
    include_routines: bool = False,
) -> dict:
    nodes: list[dict] = []
    for t in schema.table_list():
        if t.is_view and not include_views:
            continue
        nodes.append(
            {
                "id": t.fqname,
                "schema": t.schema,
                "name": t.name,
                "kind": "view" if t.is_view else "table",
                "row_count": t.row_count,
                "reserved_kb": t.reserved_kb,
                "column_count": len(t.columns),
                "has_primary_key": t.primary_key is not None,
            }
        )

    edges: list[dict] = []
    existing_ids = {n["id"] for n in nodes}
    for t in schema.table_list():
        if t.is_view and not include_views:
            continue
        for fk in t.foreign_keys:
            ref_fq = f"{fk.ref_schema}.{fk.ref_table}"
            if ref_fq not in existing_ids:
                continue
            edges.append(
                {
                    "id": f"fk:{t.fqname}->{ref_fq}:{fk.name}",
                    "source": t.fqname,
                    "target": ref_fq,
                    "kind": "fk",
                    "name": fk.name,
                    "columns": fk.columns,
                    "ref_columns": fk.ref_columns,
                    "on_delete": fk.on_delete,
                    "on_update": fk.on_update,
                }
            )

    if include_routines:
        for dep in schema.dependencies:
            src = f"{dep.referencing_schema}.{dep.referencing_name}"
            tgt = f"{dep.referenced_schema}.{dep.referenced_name}"
            if tgt in existing_ids:
                edges.append(
                    {
                        "id": f"uses:{src}->{tgt}",
                        "source": src,
                        "target": tgt,
                        "kind": "uses",
                        "name": f"{dep.referencing_type.lower()}",
                        "columns": [],
                        "ref_columns": [],
                    }
                )

    return {"nodes": nodes, "edges": edges}


def expand_selection(
    graph: dict,
    selected: list[str],
    *,
    depth: int = 1,
    direction: str = "both",
) -> dict:
    """Given a graph and selected node ids, return the subgraph within N hops.

    direction: "out" follows source->target, "in" follows target->source, "both" combines.
    Returns {nodes: [...], edges: [...], highlighted_nodes: set, highlighted_edges: set}.
    """
    by_id = {n["id"]: n for n in graph["nodes"]}
    out_adj: dict[str, list[dict]] = {nid: [] for nid in by_id}
    in_adj: dict[str, list[dict]] = {nid: [] for nid in by_id}
    for e in graph["edges"]:
        if e["source"] in out_adj:
            out_adj[e["source"]].append(e)
        if e["target"] in in_adj:
            in_adj[e["target"]].append(e)

    highlighted_nodes: set[str] = {s for s in selected if s in by_id}
    highlighted_edges: set[str] = set()
    frontier = set(highlighted_nodes)

    for _ in range(max(depth, 0)):
        next_frontier: set[str] = set()
        for n in frontier:
            if direction in ("out", "both"):
                for e in out_adj.get(n, []):
                    highlighted_edges.add(e["id"])
                    if e["target"] not in highlighted_nodes:
                        next_frontier.add(e["target"])
            if direction in ("in", "both"):
                for e in in_adj.get(n, []):
                    highlighted_edges.add(e["id"])
                    if e["source"] not in highlighted_nodes:
                        next_frontier.add(e["source"])
        highlighted_nodes |= next_frontier
        if not next_frontier:
            break
        frontier = next_frontier

    return {
        "nodes": [n for n in graph["nodes"] if n["id"] in highlighted_nodes],
        "edges": [e for e in graph["edges"] if e["id"] in highlighted_edges],
        "highlighted_nodes": sorted(highlighted_nodes),
        "highlighted_edges": sorted(highlighted_edges),
    }
