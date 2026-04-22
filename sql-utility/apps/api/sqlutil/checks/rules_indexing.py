"""Indexing-related health checks."""

from __future__ import annotations

from ..introspect.schema_model import Schema, Table
from .registry import CheckResult, Severity, register


def _leading_cols(table: Table, cols: list[str]) -> list[tuple[str, ...]]:
    """Return leading-column tuples of all indexes on the table (for FK-covers-check)."""
    return [tuple(idx.key_columns) for idx in table.indexes]


@register("idx.fk_missing_index", "Foreign key missing supporting index", Severity.HIGH, ["index", "fk"])
def fk_missing_index(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        existing = _leading_cols(t, [])
        for fk in t.foreign_keys:
            cols = tuple(fk.columns)
            covered = any(
                tuple(leading[: len(cols)]) == cols for leading in existing if len(leading) >= len(cols)
            )
            if not covered:
                cols_list = ", ".join(f"[{c}]" for c in fk.columns)
                sql = (
                    f"CREATE NONCLUSTERED INDEX [IX_{t.name}_{'_'.join(fk.columns)}] "
                    f"ON [{t.schema}].[{t.name}] ({cols_list});"
                )
                out.append(
                    CheckResult(
                        rule_id="idx.fk_missing_index",
                        severity=Severity.HIGH,
                        title="FK missing supporting index",
                        table=t.fqname,
                        column=",".join(fk.columns),
                        description=(
                            f"FK {fk.name} on ({', '.join(fk.columns)}) has no index whose leading "
                            f"columns match. Joins and cascading deletes will scan."
                        ),
                        remediation_sql=sql,
                        tags=["index", "fk"],
                    )
                )
    return out


@register("idx.duplicate", "Duplicate / overlapping indexes", Severity.MEDIUM, ["index"])
def duplicate_indexes(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        seen: dict[tuple[str, ...], str] = {}
        for idx in t.indexes:
            key = tuple(idx.key_columns)
            if not key:
                continue
            if key in seen:
                out.append(
                    CheckResult(
                        rule_id="idx.duplicate",
                        severity=Severity.MEDIUM,
                        title="Duplicate index",
                        table=t.fqname,
                        column=",".join(key),
                        description=(
                            f"Index [{idx.name}] has the same key columns as [{seen[key]}]. "
                            f"Drop whichever is less used."
                        ),
                        remediation_sql=f"-- review, then: DROP INDEX [{idx.name}] ON [{t.schema}].[{t.name}];",
                        tags=["index"],
                    )
                )
            else:
                seen[key] = idx.name
    return out


@register("idx.unused", "Unused indexes (no seeks/scans since restart)", Severity.LOW, ["index"])
def unused_indexes(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view or t.row_count < 1000:
            continue
        for idx in t.indexes:
            if idx.is_primary_key or idx.is_unique_constraint:
                continue
            reads = idx.user_seeks + idx.user_scans + idx.user_lookups
            if reads == 0 and idx.user_updates > 0:
                out.append(
                    CheckResult(
                        rule_id="idx.unused",
                        severity=Severity.LOW,
                        title="Index has writes but no reads",
                        table=t.fqname,
                        column=",".join(idx.key_columns),
                        description=(
                            f"Index [{idx.name}] has had {idx.user_updates} writes and zero "
                            f"reads since last SQL Server restart. Consider dropping if trend holds."
                        ),
                        remediation_sql=f"-- after confirming trend: DROP INDEX [{idx.name}] ON [{t.schema}].[{t.name}];",
                        tags=["index"],
                    )
                )
    return out


@register("idx.heap_large", "Heap table (no clustered index)", Severity.MEDIUM, ["index", "heap"])
def heap_tables(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        has_clustered = any(i.type_desc == "CLUSTERED" for i in t.indexes)
        if not has_clustered and t.row_count > 1000:
            out.append(
                CheckResult(
                    rule_id="idx.heap_large",
                    severity=Severity.MEDIUM,
                    title="Heap table with significant row count",
                    table=t.fqname,
                    column=None,
                    description=(
                        f"{t.fqname} has {t.row_count:,} rows and no clustered index. "
                        f"Heaps fragment badly and forwarded records hurt scan performance."
                    ),
                    remediation_sql=(
                        f"-- pick a key; commonly a surrogate id or natural key\n"
                        f"CREATE CLUSTERED INDEX [IX_{t.name}_pk] ON [{t.schema}].[{t.name}] (<key_col> ASC);"
                    ),
                    tags=["index", "heap"],
                )
            )
    return out


@register("idx.disabled", "Disabled index", Severity.MEDIUM, ["index"])
def disabled_indexes(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        for idx in t.indexes:
            if idx.is_disabled:
                out.append(
                    CheckResult(
                        rule_id="idx.disabled",
                        severity=Severity.MEDIUM,
                        title="Disabled index",
                        table=t.fqname,
                        column=",".join(idx.key_columns),
                        description=f"Index [{idx.name}] is disabled and not maintained.",
                        remediation_sql=(
                            f"ALTER INDEX [{idx.name}] ON [{t.schema}].[{t.name}] REBUILD; "
                            f"-- or DROP if intentional"
                        ),
                        tags=["index"],
                    )
                )
    return out
