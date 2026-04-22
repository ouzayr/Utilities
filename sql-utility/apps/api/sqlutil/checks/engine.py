from __future__ import annotations

from ..introspect.schema_model import Schema
from . import rules_indexing, rules_pii, rules_schema, rules_stats  # noqa: F401 import-to-register
from .registry import REGISTRY, CheckResult, Severity

__all__ = ["REGISTRY", "CheckResult", "Severity", "run_all_checks"]


def run_all_checks(schema: Schema) -> list[CheckResult]:
    results: list[CheckResult] = []
    for _rule_id, _title, _sev, _tags, fn in REGISTRY:
        try:
            results.extend(fn(schema))
        except Exception as e:  # pragma: no cover - belt & braces
            results.append(
                CheckResult(
                    rule_id=_rule_id,
                    severity=Severity.LOW,
                    title="check failed",
                    table=None,
                    column=None,
                    description=f"Rule raised: {e}",
                )
            )
    return results
