"""Schema diff between two SQL Server databases.

Compares tables, columns, primary keys, unique constraints, foreign keys,
indexes, and routines (views / stored procedures / functions / triggers).

Output is a structured report with `added`, `removed`, and `changed` buckets.
For safe additive changes we generate migration SQL; destructive changes are
left for the user to review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..introspect.schema_model import ForeignKey, Index, Schema, Table


@dataclass
class DiffEntry:
    kind: str            # "table" | "column" | "primary_key" | "foreign_key" | "index" | "unique" | "routine"
    op: str              # "added" | "removed" | "changed"
    object: str          # fqname or qualified entity
    details: dict[str, Any] = field(default_factory=dict)
    migration_sql: str | None = None


@dataclass
class DiffResult:
    source: str
    target: str
    entries: list[DiffEntry] = field(default_factory=list)

    def summary(self) -> dict[str, int]:
        s: dict[str, int] = {}
        for e in self.entries:
            key = f"{e.kind}.{e.op}"
            s[key] = s.get(key, 0) + 1
        return s

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "summary": self.summary(),
            "entries": [
                {
                    "kind": e.kind,
                    "op": e.op,
                    "object": e.object,
                    "details": e.details,
                    "migration_sql": e.migration_sql,
                }
                for e in self.entries
            ],
        }


def _column_shape(c) -> dict[str, Any]:
    return {
        "data_type": c.type_string(),
        "nullable": c.is_nullable,
        "identity": c.is_identity,
        "computed": c.is_computed,
        "default": c.default_definition,
    }


def _fk_shape(fk: ForeignKey) -> dict[str, Any]:
    return {
        "columns": fk.columns,
        "ref": f"{fk.ref_schema}.{fk.ref_table}",
        "ref_columns": fk.ref_columns,
        "on_delete": fk.on_delete,
        "on_update": fk.on_update,
    }


def _idx_shape(i: Index) -> dict[str, Any]:
    return {
        "type": i.type_desc,
        "unique": i.is_unique,
        "key_columns": i.key_columns,
        "included_columns": i.included_columns,
        "filter": i.filter_definition,
    }


def _add_table_sql(t: Table) -> str:
    cols = []
    for c in t.columns:
        parts = [f"[{c.name}]", c.type_string()]
        if not c.is_nullable:
            parts.append("NOT NULL")
        if c.is_identity:
            parts.append("IDENTITY(1,1)")
        if c.default_definition:
            parts.append(f"DEFAULT {c.default_definition.strip()}")
        cols.append("  " + " ".join(parts))
    pk_line = ""
    if t.primary_key:
        pk_cols = ", ".join(f"[{c}]" for c in t.primary_key.columns)
        pk_line = f",\n  CONSTRAINT [{t.primary_key.name}] PRIMARY KEY ({pk_cols})"
    body = ",\n".join(cols) + pk_line
    return f"CREATE TABLE [{t.schema}].[{t.name}] (\n{body}\n);"


def diff_schemas(source: Schema, target: Schema, *, source_name: str, target_name: str) -> DiffResult:
    """Return entries describing how to bring *target* up to match *source*.

    Conceptually: "what's in source that target is missing / different."
    """
    result = DiffResult(source=source_name, target=target_name)

    src_tables = source.tables
    tgt_tables = target.tables

    # -- tables ----------------------------------------------------------
    for fq, t in src_tables.items():
        if fq not in tgt_tables:
            result.entries.append(
                DiffEntry(
                    kind="table",
                    op="added",
                    object=fq,
                    details={"column_count": len(t.columns)},
                    migration_sql=_add_table_sql(t) if not t.is_view else None,
                )
            )
    for fq in tgt_tables:
        if fq not in src_tables:
            result.entries.append(
                DiffEntry(
                    kind="table",
                    op="removed",
                    object=fq,
                    details={},
                    migration_sql=f"-- review before dropping: DROP TABLE [{fq.replace('.', '].[')}];",
                )
            )

    # -- columns / PK / FK / indexes within common tables ---------------
    for fq in src_tables.keys() & tgt_tables.keys():
        s = src_tables[fq]
        t = tgt_tables[fq]
        _diff_columns(fq, s, t, result)
        _diff_pk(fq, s, t, result)
        _diff_unique(fq, s, t, result)
        _diff_fk(fq, s, t, result)
        _diff_indexes(fq, s, t, result)

    return result


def _diff_columns(fq: str, s: Table, t: Table, result: DiffResult) -> None:
    s_cols = {c.name: c for c in s.columns}
    t_cols = {c.name: c for c in t.columns}
    schema, name = s.schema, s.name
    for cn, sc in s_cols.items():
        if cn not in t_cols:
            parts = [f"[{cn}]", sc.type_string()]
            if not sc.is_nullable:
                parts.append("NOT NULL")
            if sc.default_definition:
                parts.append(f"DEFAULT {sc.default_definition.strip()}")
            result.entries.append(
                DiffEntry(
                    kind="column",
                    op="added",
                    object=f"{fq}.{cn}",
                    details=_column_shape(sc),
                    migration_sql=f"ALTER TABLE [{schema}].[{name}] ADD {' '.join(parts)};",
                )
            )
        else:
            ss, ts = _column_shape(sc), _column_shape(t_cols[cn])
            if ss != ts:
                tc = t_cols[cn]
                not_null = "" if sc.is_nullable else " NOT NULL"
                result.entries.append(
                    DiffEntry(
                        kind="column",
                        op="changed",
                        object=f"{fq}.{cn}",
                        details={"source": ss, "target": ts},
                        migration_sql=(
                            f"-- review carefully; may need data migration\n"
                            f"ALTER TABLE [{schema}].[{name}] ALTER COLUMN [{cn}] {sc.type_string()}{not_null};"
                            if ss["data_type"] != ts["data_type"] or ss["nullable"] != ts["nullable"]
                            else None
                        ),
                    )
                )
                _ = tc  # silence unused
    for cn in t_cols:
        if cn not in s_cols:
            result.entries.append(
                DiffEntry(
                    kind="column",
                    op="removed",
                    object=f"{fq}.{cn}",
                    details={},
                    migration_sql=f"-- review before dropping: ALTER TABLE [{schema}].[{name}] DROP COLUMN [{cn}];",
                )
            )


def _diff_pk(fq: str, s: Table, t: Table, result: DiffResult) -> None:
    s_cols = s.primary_key.columns if s.primary_key else []
    t_cols = t.primary_key.columns if t.primary_key else []
    if s_cols != t_cols:
        if not s_cols and t_cols:
            result.entries.append(
                DiffEntry(
                    kind="primary_key",
                    op="removed",
                    object=fq,
                    details={"target_columns": t_cols},
                )
            )
        elif s_cols and not t_cols:
            cols = ", ".join(f"[{c}]" for c in s_cols)
            result.entries.append(
                DiffEntry(
                    kind="primary_key",
                    op="added",
                    object=fq,
                    details={"columns": s_cols},
                    migration_sql=(
                        f"ALTER TABLE [{s.schema}].[{s.name}] ADD CONSTRAINT [PK_{s.name}] PRIMARY KEY ({cols});"
                    ),
                )
            )
        else:
            result.entries.append(
                DiffEntry(
                    kind="primary_key",
                    op="changed",
                    object=fq,
                    details={"source_columns": s_cols, "target_columns": t_cols},
                )
            )


def _diff_unique(fq: str, s: Table, t: Table, result: DiffResult) -> None:
    s_set = {tuple(u.columns): u for u in s.unique_constraints}
    t_set = {tuple(u.columns): u for u in t.unique_constraints}
    for cols, u in s_set.items():
        if cols not in t_set:
            col_list = ", ".join(f"[{c}]" for c in cols)
            result.entries.append(
                DiffEntry(
                    kind="unique",
                    op="added",
                    object=f"{fq}.{u.name}",
                    details={"columns": list(cols)},
                    migration_sql=f"ALTER TABLE [{s.schema}].[{s.name}] ADD CONSTRAINT [{u.name}] UNIQUE ({col_list});",
                )
            )
    for cols, u in t_set.items():
        if cols not in s_set:
            result.entries.append(
                DiffEntry(
                    kind="unique",
                    op="removed",
                    object=f"{fq}.{u.name}",
                    details={"columns": list(cols)},
                )
            )


def _diff_fk(fq: str, s: Table, t: Table, result: DiffResult) -> None:
    s_fk = {fk.name: fk for fk in s.foreign_keys}
    t_fk = {fk.name: fk for fk in t.foreign_keys}
    for name, fk in s_fk.items():
        if name not in t_fk:
            cols = ", ".join(f"[{c}]" for c in fk.columns)
            ref_cols = ", ".join(f"[{c}]" for c in fk.ref_columns)
            result.entries.append(
                DiffEntry(
                    kind="foreign_key",
                    op="added",
                    object=f"{fq}.{name}",
                    details=_fk_shape(fk),
                    migration_sql=(
                        f"ALTER TABLE [{s.schema}].[{s.name}] WITH CHECK ADD CONSTRAINT [{name}] "
                        f"FOREIGN KEY ({cols}) REFERENCES [{fk.ref_schema}].[{fk.ref_table}] ({ref_cols});"
                    ),
                )
            )
        else:
            if _fk_shape(fk) != _fk_shape(t_fk[name]):
                result.entries.append(
                    DiffEntry(
                        kind="foreign_key",
                        op="changed",
                        object=f"{fq}.{name}",
                        details={"source": _fk_shape(fk), "target": _fk_shape(t_fk[name])},
                    )
                )
    for name, fk in t_fk.items():
        if name not in s_fk:
            result.entries.append(
                DiffEntry(
                    kind="foreign_key",
                    op="removed",
                    object=f"{fq}.{name}",
                    details=_fk_shape(fk),
                )
            )


def _diff_indexes(fq: str, s: Table, t: Table, result: DiffResult) -> None:
    s_idx = {i.name: i for i in s.indexes if not i.is_primary_key and not i.is_unique_constraint}
    t_idx = {i.name: i for i in t.indexes if not i.is_primary_key and not i.is_unique_constraint}
    for name, i in s_idx.items():
        if name not in t_idx:
            cols = ", ".join(f"[{c}]" for c in i.key_columns)
            incl = f" INCLUDE ({', '.join(f'[{c}]' for c in i.included_columns)})" if i.included_columns else ""
            filt = f" WHERE {i.filter_definition}" if i.has_filter and i.filter_definition else ""
            unique = "UNIQUE " if i.is_unique else ""
            result.entries.append(
                DiffEntry(
                    kind="index",
                    op="added",
                    object=f"{fq}.{name}",
                    details=_idx_shape(i),
                    migration_sql=(
                        f"CREATE {unique}{i.type_desc} INDEX [{name}] "
                        f"ON [{s.schema}].[{s.name}] ({cols}){incl}{filt};"
                    ),
                )
            )
        else:
            if _idx_shape(i) != _idx_shape(t_idx[name]):
                result.entries.append(
                    DiffEntry(
                        kind="index",
                        op="changed",
                        object=f"{fq}.{name}",
                        details={"source": _idx_shape(i), "target": _idx_shape(t_idx[name])},
                    )
                )
    for name, i in t_idx.items():
        if name not in s_idx:
            result.entries.append(
                DiffEntry(
                    kind="index",
                    op="removed",
                    object=f"{fq}.{name}",
                    details=_idx_shape(i),
                    migration_sql=f"-- review: DROP INDEX [{name}] ON [{fq.replace('.', '].[')}];",
                )
            )


def diff_routines(source_routines: list[dict], target_routines: list[dict], result: DiffResult) -> None:
    """Compare stored procedures / functions / views / triggers by name + definition."""
    def key(r: dict) -> str:
        return f"{r['schema_name']}.{r['name']}"

    src = {key(r): r for r in source_routines}
    tgt = {key(r): r for r in target_routines}
    for k, r in src.items():
        if k not in tgt:
            result.entries.append(
                DiffEntry(
                    kind="routine",
                    op="added",
                    object=f"{k} ({r['type_desc']})",
                    details={"type": r["type_desc"]},
                    migration_sql=r.get("definition"),
                )
            )
        elif (r.get("definition") or "") != (tgt[k].get("definition") or ""):
            result.entries.append(
                DiffEntry(
                    kind="routine",
                    op="changed",
                    object=f"{k} ({r['type_desc']})",
                    details={"type": r["type_desc"]},
                    migration_sql=(r.get("definition") or "").replace("CREATE ", "CREATE OR ALTER ", 1),
                )
            )
    for k, r in tgt.items():
        if k not in src:
            result.entries.append(
                DiffEntry(
                    kind="routine",
                    op="removed",
                    object=f"{k} ({r['type_desc']})",
                    details={"type": r["type_desc"]},
                )
            )
