from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_connection
from ..diff import diff_schemas
from ..diff.differ import diff_routines
from ..introspect import build_schema
from ..introspect.routines import get_routines

router = APIRouter()


class DiffIn(BaseModel):
    source_connection_id: str
    target_connection_id: str
    include_routines: bool = True


@router.post("/schemas")
def diff(body: DiffIn) -> dict:
    with get_connection(body.source_connection_id, timeout=120) as src:
        s_schema = build_schema(src)
        s_routines = get_routines(src) if body.include_routines else []
        s_name_row = src.fetch_one("SELECT DB_NAME() AS db")
    with get_connection(body.target_connection_id, timeout=120) as tgt:
        t_schema = build_schema(tgt)
        t_routines = get_routines(tgt) if body.include_routines else []
        t_name_row = tgt.fetch_one("SELECT DB_NAME() AS db")

    result = diff_schemas(
        s_schema,
        t_schema,
        source_name=(s_name_row or {}).get("db") or body.source_connection_id,
        target_name=(t_name_row or {}).get("db") or body.target_connection_id,
    )
    if body.include_routines:
        diff_routines(s_routines, t_routines, result)
    return result.to_dict()
