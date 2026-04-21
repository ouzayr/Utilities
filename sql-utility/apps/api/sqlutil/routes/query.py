"""Ad-hoc query playground endpoints.

Intentionally conservative:
  - read-only enforced by the connection's SQL login (recommended) and by
    rejecting statements that start with write keywords on the server side.
  - `explain` wraps the statement with SET SHOWPLAN_XML ON to return the plan
    without executing it.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_connection

router = APIRouter()

_WRITE_RX = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|EXEC|GRANT|REVOKE|DENY)\b",
    re.IGNORECASE,
)


class QueryIn(BaseModel):
    sql: str
    max_rows: int = 200


@router.post("/run")
def run_query(connection_id: str, body: QueryIn) -> dict:
    if _WRITE_RX.match(body.sql):
        raise HTTPException(status_code=400, detail="only read-only statements are allowed")
    with get_connection(connection_id, timeout=60) as c:
        rows = c.fetch_all(body.sql)
    return {"row_count": len(rows), "rows": rows[: body.max_rows]}


@router.post("/explain")
def explain(connection_id: str, body: QueryIn) -> dict:
    if _WRITE_RX.match(body.sql):
        raise HTTPException(status_code=400, detail="only read-only statements can be explained")
    with get_connection(connection_id, timeout=60) as c:
        c.execute("SET SHOWPLAN_XML ON")
        plan = c.fetch_all(body.sql)
        c.execute("SET SHOWPLAN_XML OFF")
    return {"plan_xml": plan}
