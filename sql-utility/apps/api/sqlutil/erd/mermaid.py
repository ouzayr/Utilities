"""Mermaid `erDiagram` output for a selected subset of tables."""

from __future__ import annotations

import re

from ..introspect.schema_model import Schema

_SAFE = re.compile(r"[^A-Za-z0-9_]")


def _safe(name: str) -> str:
    return _SAFE.sub("_", name)


def to_mermaid(schema: Schema, selected_fqnames: list[str] | None = None) -> str:
    selected = set(selected_fqnames) if selected_fqnames else set(schema.tables.keys())
    lines = ["erDiagram"]
    for fq in sorted(selected):
        t = schema.tables.get(fq)
        if t is None or t.is_view:
            continue
        safe = _safe(fq)
        lines.append(f"    {safe} {{")
        pk_cols = set(t.primary_key.columns) if t.primary_key else set()
        fk_cols = {c for fk in t.foreign_keys for c in fk.columns}
        for c in t.columns:
            tag = ""
            if c.name in pk_cols and c.name in fk_cols:
                tag = "PK,FK"
            elif c.name in pk_cols:
                tag = "PK"
            elif c.name in fk_cols:
                tag = "FK"
            comment = ""
            if c.description:
                short = c.description.strip().splitlines()[0][:60].replace('"', "'")
                comment = f' "{short}"'
            type_str = c.type_string()
            lines.append(f"        {_safe(c.name)} {type_str}{(' ' + tag) if tag else ''}{comment}")
        lines.append("    }")

    seen: set[tuple[str, str, str]] = set()
    for fq in selected:
        t = schema.tables.get(fq)
        if t is None:
            continue
        for fk in t.foreign_keys:
            ref_fq = f"{fk.ref_schema}.{fk.ref_table}"
            if ref_fq not in selected:
                continue
            key = (fq, ref_fq, fk.name)
            if key in seen:
                continue
            seen.add(key)
            # many-to-one from parent table to referenced table
            label = fk.name if fk.name else "ref"
            lines.append(f"    {_safe(ref_fq)} ||--o{{ {_safe(fq)} : \"{label}\"")
    return "\n".join(lines)
