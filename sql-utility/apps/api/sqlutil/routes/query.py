"""Ad-hoc query playground endpoints.

Intentionally conservative:
  - read-only enforced by the connection's SQL login (recommended) *and*
    by validating the submitted batch with :mod:`sqlutil.db.readonly`, which
    strips comments, splits on top-level semicolons, and rejects anything
    that isn't on the read-only allow-list.
  - `explain` wraps the statement with SET SHOWPLAN_XML ON to return the plan
    without executing it.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_connection
from ..db.readonly import WriteAttemptError, assert_read_only

router = APIRouter()


class QueryIn(BaseModel):
    sql: str
    max_rows: int = 200


def _require_readonly(sql: str) -> None:
    try:
        assert_read_only(sql)
    except WriteAttemptError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/run")
def run_query(connection_id: str, body: QueryIn) -> dict:
    _require_readonly(body.sql)
    with get_connection(connection_id, timeout=60) as c:
        rows = c.fetch_all(body.sql)
    return {"row_count": len(rows), "rows": rows[: body.max_rows]}


@router.post("/explain")
def explain(connection_id: str, body: QueryIn) -> dict:
    _require_readonly(body.sql)
    with get_connection(connection_id, timeout=60) as c:
        c.execute("SET SHOWPLAN_XML ON")
        plan = c.fetch_all(body.sql)
        c.execute("SET SHOWPLAN_XML OFF")
    return {"plan_xml": plan}
