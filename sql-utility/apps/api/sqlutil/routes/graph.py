from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..db import get_connection
from ..graph.resolver import build_graph, expand_selection
from ..introspect import build_schema

router = APIRouter()


@router.get("/graph")
def get_graph(
    connection_id: str,
    include_views: bool = Query(default=True),
    include_routines: bool = Query(default=False),
) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
    return build_graph(schema, include_views=include_views, include_routines=include_routines)


class ExpandIn(BaseModel):
    selected: list[str]
    depth: int = 1
    direction: str = "both"
    include_views: bool = True
    include_routines: bool = False


@router.post("/graph/expand")
def expand(connection_id: str, body: ExpandIn) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
    g = build_graph(schema, include_views=body.include_views, include_routines=body.include_routines)
    return expand_selection(g, body.selected, depth=body.depth, direction=body.direction)
