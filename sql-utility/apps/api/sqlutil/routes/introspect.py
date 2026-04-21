from __future__ import annotations

from fastapi import APIRouter, Query

from ..db import get_connection
from ..introspect import build_schema
from ..introspect.routines import get_routines

router = APIRouter()


@router.get("/schema")
def schema(connection_id: str) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        return build_schema(c).to_dict()


@router.get("/tables")
def tables(connection_id: str, schema_name: str | None = Query(default=None)) -> list[dict]:
    with get_connection(connection_id) as c:
        s = build_schema(c)
    out = []
    for t in s.table_list():
        if schema_name and t.schema != schema_name:
            continue
        out.append(
            {
                "schema": t.schema,
                "name": t.name,
                "fqname": t.fqname,
                "is_view": t.is_view,
                "row_count": t.row_count,
                "reserved_kb": t.reserved_kb,
                "column_count": len(t.columns),
                "primary_key": t.primary_key.columns if t.primary_key else [],
                "fk_count": len(t.foreign_keys),
                "index_count": len(t.indexes),
            }
        )
    return out


@router.get("/routines")
def routines(connection_id: str) -> list[dict]:
    with get_connection(connection_id) as c:
        return get_routines(c)
