"""Schema hygiene health checks."""

from __future__ import annotations

import re

from ..introspect.schema_model import Schema
from .registry import CheckResult, Severity, register


@register("schema.missing_pk", "Table has no primary key", Severity.HIGH, ["schema"])
def missing_primary_key(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        if t.primary_key is None:
            out.append(
                CheckResult(
                    rule_id="schema.missing_pk",
                    severity=Severity.HIGH,
                    title="Missing primary key",
                    table=t.fqname,
                    column=None,
                    description=(
                        f"{t.fqname} has no primary key. Replication, MERGE, and row-level "
                        f"operations become unreliable without one."
                    ),
                    remediation_sql=(
                        f"-- choose a column set; e.g.\n"
                        f"ALTER TABLE [{t.schema}].[{t.name}] ADD CONSTRAINT [PK_{t.name}] PRIMARY KEY (<cols>);"
                    ),
                    tags=["schema"],
                )
            )
    return out


@register("schema.nullable_fk", "Foreign key column is nullable", Severity.LOW, ["schema", "fk"])
def nullable_fk(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        col_by_name = {c.name: c for c in t.columns}
        for fk in t.foreign_keys:
            for cn in fk.columns:
                col = col_by_name.get(cn)
                if col and col.is_nullable:
                    out.append(
                        CheckResult(
                            rule_id="schema.nullable_fk",
                            severity=Severity.LOW,
                            title="Nullable FK column",
                            table=t.fqname,
                            column=cn,
                            description=(
                                f"FK column {cn} on {t.fqname} is nullable. If the relationship is "
                                f"mandatory, add NOT NULL and backfill."
                            ),
                            remediation_sql=(
                                f"ALTER TABLE [{t.schema}].[{t.name}] ALTER COLUMN [{cn}] "
                                f"{col.type_string()} NOT NULL;"
                            ),
                            tags=["schema", "fk"],
                        )
                    )
    return out


@register("schema.fk_not_trusted", "Foreign key is not trusted", Severity.MEDIUM, ["schema", "fk"])
def untrusted_fk(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        for fk in t.foreign_keys:
            if fk.is_not_trusted and not fk.is_disabled:
                out.append(
                    CheckResult(
                        rule_id="schema.fk_not_trusted",
                        severity=Severity.MEDIUM,
                        title="Untrusted foreign key",
                        table=t.fqname,
                        column=",".join(fk.columns),
                        description=(
                            f"FK {fk.name} is not trusted. The query optimizer cannot use it "
                            f"for plan elimination until it's re-checked."
                        ),
                        remediation_sql=(
                            f"ALTER TABLE [{t.schema}].[{t.name}] WITH CHECK CHECK CONSTRAINT [{fk.name}];"
                        ),
                        tags=["schema", "fk"],
                    )
                )
    return out


_MAX_TYPES = {"varchar", "nvarchar"}


@register("schema.text_max", "varchar(max) / nvarchar(max) used", Severity.INFO, ["schema", "types"])
def text_max(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        for c in t.columns:
            if c.data_type.lower() in _MAX_TYPES and c.max_length == -1:
                out.append(
                    CheckResult(
                        rule_id="schema.text_max",
                        severity=Severity.INFO,
                        title="Unbounded text column",
                        table=t.fqname,
                        column=c.name,
                        description=(
                            f"{t.fqname}.{c.name} is {c.data_type}(max). If you know an upper "
                            f"bound, a bounded length packs better in-row and is easier to index."
                        ),
                        tags=["schema", "types"],
                    )
                )
    return out


@register("schema.float_money", "float/real used where decimal is safer", Severity.MEDIUM, ["schema", "types"])
def float_money(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        for c in t.columns:
            name_l = c.name.lower()
            is_moneyish = any(k in name_l for k in ("amount", "price", "cost", "total", "balance", "fee"))
            if is_moneyish and c.data_type.lower() in ("float", "real"):
                out.append(
                    CheckResult(
                        rule_id="schema.float_money",
                        severity=Severity.MEDIUM,
                        title="Monetary value stored in floating-point type",
                        table=t.fqname,
                        column=c.name,
                        description=(
                            f"{t.fqname}.{c.name} is {c.data_type}. Floating-point rounding will "
                            f"cause subtle accounting errors. Use decimal(p, s)."
                        ),
                        remediation_sql=(
                            f"ALTER TABLE [{t.schema}].[{t.name}] ALTER COLUMN [{c.name}] "
                            f"decimal(18, 4){' NOT NULL' if not c.is_nullable else ''};"
                        ),
                        tags=["schema", "types"],
                    )
                )
    return out


@register("schema.datetime_legacy", "datetime used instead of datetime2", Severity.LOW, ["schema", "types"])
def datetime_legacy(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        for c in t.columns:
            if c.data_type.lower() == "datetime":
                out.append(
                    CheckResult(
                        rule_id="schema.datetime_legacy",
                        severity=Severity.LOW,
                        title="Legacy datetime type",
                        table=t.fqname,
                        column=c.name,
                        description=(
                            f"{t.fqname}.{c.name} is datetime. datetime2 has better precision "
                            f"and smaller storage."
                        ),
                        tags=["schema", "types"],
                    )
                )
    return out


_PK_SUFFIX = re.compile(r"(_|^)id$", re.IGNORECASE)


@register("schema.id_not_fk", "Column looks like an FK but isn't declared", Severity.LOW, ["schema", "fk"])
def id_not_fk(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        fk_cols = {c for fk in t.foreign_keys for c in fk.columns}
        pk_cols = set(t.primary_key.columns) if t.primary_key else set()
        for c in t.columns:
            if c.name in pk_cols or c.name in fk_cols:
                continue
            if _PK_SUFFIX.search(c.name) and c.name.lower() not in ("id",):
                out.append(
                    CheckResult(
                        rule_id="schema.id_not_fk",
                        severity=Severity.LOW,
                        title="Column looks like FK but is not declared",
                        table=t.fqname,
                        column=c.name,
                        description=(
                            f"{t.fqname}.{c.name} ends in _id and isn't part of a PK or FK. "
                            f"Consider adding a FOREIGN KEY constraint."
                        ),
                        tags=["schema", "fk"],
                    )
                )
    return out
