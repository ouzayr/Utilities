"""Heuristic PII detection. Flags columns that likely hold personal data."""

from __future__ import annotations

import re

from ..introspect.schema_model import Schema
from .registry import CheckResult, Severity, register

_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"(^|_)e?mail($|_)", re.IGNORECASE),
    "phone": re.compile(r"(^|_)(phone|mobile|cell|tel)($|_)", re.IGNORECASE),
    "ssn": re.compile(r"(^|_)(ssn|national_id|nin)($|_)", re.IGNORECASE),
    "first_name": re.compile(r"(^|_)(first|given)_?name($|_)", re.IGNORECASE),
    "last_name": re.compile(r"(^|_)(last|family|sur)_?name($|_)", re.IGNORECASE),
    "dob": re.compile(r"(^|_)(dob|birth(date)?)($|_)", re.IGNORECASE),
    "address": re.compile(r"(^|_)address($|_)", re.IGNORECASE),
    "credit_card": re.compile(r"(^|_)(cc|card)(_?number|_?no)?($|_)", re.IGNORECASE),
    "passport": re.compile(r"passport", re.IGNORECASE),
    "ip_address": re.compile(r"(^|_)ip(_?addr(ess)?)?($|_)", re.IGNORECASE),
}


@register("pii.likely_column", "Column likely contains PII", Severity.MEDIUM, ["security", "pii"])
def pii_columns(schema: Schema) -> list[CheckResult]:
    out: list[CheckResult] = []
    for t in schema.table_list():
        if t.is_view:
            continue
        for c in t.columns:
            for label, pat in _PII_PATTERNS.items():
                if pat.search(c.name):
                    out.append(
                        CheckResult(
                            rule_id="pii.likely_column",
                            severity=Severity.MEDIUM,
                            title=f"Likely PII ({label})",
                            table=t.fqname,
                            column=c.name,
                            description=(
                                f"{t.fqname}.{c.name} looks like it holds {label.replace('_', ' ')}. "
                                f"Consider column-level encryption, dynamic data masking, or a RLS policy."
                            ),
                            tags=["security", "pii", label],
                        )
                    )
                    break
    return out
