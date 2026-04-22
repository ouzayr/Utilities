from __future__ import annotations

from fastapi import APIRouter, Query

from ..db import get_connection
from ..erd import to_dbml, to_mermaid
from ..introspect import build_schema

router = APIRouter()


@router.get("/erd/mermaid", response_class=None)
def erd_mermaid(
    connection_id: str,
    tables: list[str] | None = Query(default=None),
) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
    return {"format": "mermaid", "body": to_mermaid(schema, selected_fqnames=tables)}


@router.get("/erd/dbml")
def erd_dbml(
    connection_id: str,
    tables: list[str] | None = Query(default=None),
) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
    return {"format": "dbml", "body": to_dbml(schema, selected_fqnames=tables)}
