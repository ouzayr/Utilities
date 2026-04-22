from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

from ..introspect.schema_model import Schema


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class CheckResult:
    rule_id: str
    severity: Severity
    title: str
    table: str | None
    column: str | None
    description: str
    remediation_sql: str | None = None
    tags: list[str] = field(default_factory=list)


CheckFn = Callable[[Schema], list[CheckResult]]
REGISTRY: list[tuple[str, str, Severity, list[str], CheckFn]] = []


def register(rule_id: str, title: str, severity: Severity, tags: list[str] | None = None):
    def _decorator(fn: CheckFn) -> CheckFn:
        REGISTRY.append((rule_id, title, severity, tags or [], fn))
        return fn

    return _decorator
