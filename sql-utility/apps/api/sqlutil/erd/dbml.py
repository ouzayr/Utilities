"""DBML output (dbdocs.io-compatible) for a selected subset of tables."""

from __future__ import annotations

from ..introspect.schema_model import Schema


def _fmt_default(default: str | None) -> str:
    if not default:
        return ""
    return f" [default: `{default.strip('() ')}`]"


def to_dbml(schema: Schema, selected_fqnames: list[str] | None = None) -> str:
    selected = set(selected_fqnames) if selected_fqnames else set(schema.tables.keys())
    parts: list[str] = []

    for fq in sorted(selected):
        t = schema.tables.get(fq)
        if t is None or t.is_view:
            continue
        header = f'Table "{fq}"'
        if t.description:
            first = t.description.strip().splitlines()[0].replace('"', "'")
            header += f' [note: "{first}"]'
        parts.append(header + " {")

        pk_cols = set(t.primary_key.columns) if t.primary_key else set()
        for c in t.columns:
            attrs: list[str] = []
            if c.name in pk_cols:
                attrs.append("pk")
            if not c.is_nullable:
                attrs.append("not null")
            if c.is_identity:
                attrs.append("increment")
            if c.default_definition:
                attrs.append(f"default: `{c.default_definition.strip('() ')}`")
            if c.description:
                note = c.description.strip().splitlines()[0][:120].replace('"', "'")
                attrs.append(f"note: '{note}'")
            attr_s = f" [{', '.join(attrs)}]" if attrs else ""
            parts.append(f'  "{c.name}" {c.type_string()}{attr_s}')

        parts.append("}")
        parts.append("")

    for fq in sorted(selected):
        t = schema.tables.get(fq)
        if t is None:
            continue
        for fk in t.foreign_keys:
            ref_fq = f"{fk.ref_schema}.{fk.ref_table}"
            if ref_fq not in selected:
                continue
            if len(fk.columns) == 1 and len(fk.ref_columns) == 1:
                parts.append(f'Ref: "{fq}"."{fk.columns[0]}" > "{ref_fq}"."{fk.ref_columns[0]}"')
            else:
                cols = ", ".join(f'"{c}"' for c in fk.columns)
                ref_cols = ", ".join(f'"{c}"' for c in fk.ref_columns)
                parts.append(f'Ref: "{fq}".({cols}) > "{ref_fq}".({ref_cols})')

    return "\n".join(parts) + "\n"
