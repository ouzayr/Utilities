from __future__ import annotations

from fastapi import APIRouter

from ..checks.engine import REGISTRY, run_all_checks
from ..db import get_connection
from ..introspect import build_schema

router = APIRouter()


@router.get("/checks")
def list_rules() -> list[dict]:
    return [
        {"rule_id": rid, "title": title, "severity": sev.value, "tags": tags}
        for rid, title, sev, tags, _ in REGISTRY
    ]


@router.post("/checks/run")
def run_checks(connection_id: str) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
    results = run_all_checks(schema)
    severity_counts: dict[str, int] = {}
    for r in results:
        severity_counts[r.severity.value] = severity_counts.get(r.severity.value, 0) + 1
    return {
        "summary": severity_counts,
        "results": [
            {
                "rule_id": r.rule_id,
                "severity": r.severity.value,
                "title": r.title,
                "table": r.table,
                "column": r.column,
                "description": r.description,
                "remediation_sql": r.remediation_sql,
                "tags": r.tags,
            }
            for r in results
        ],
    }
