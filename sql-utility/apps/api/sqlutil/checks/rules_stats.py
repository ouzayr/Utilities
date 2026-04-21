"""Stats & usage-based rules that use sys.dm_* counters captured in introspection."""

from __future__ import annotations

from ..introspect.schema_model import Schema
from .registry import CheckResult, Severity, register


@register("stats.large_no_indexes", "Large table with no non-clustered indexes", Severity.MEDIUM, ["index"])
def large_no_nc(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view or t.row_count < 50_000:
            continue
        nc = [i for i in t.indexes if i.type_desc == "NONCLUSTERED"]
        if not nc:
            out.append(
                CheckResult(
                    rule_id="stats.large_no_indexes",
                    severity=Severity.MEDIUM,
                    title="Large table with no non-clustered indexes",
                    table=t.fqname,
                    column=None,
                    description=(
                        f"{t.fqname} has {t.row_count:,} rows and no non-clustered indexes. "
                        f"Any WHERE/JOIN besides the clustering key will scan."
                    ),
                    tags=["index"],
                )
            )
    return out
