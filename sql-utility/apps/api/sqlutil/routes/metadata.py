from __future__ import annotations

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel

from ..db import get_connection
from ..introspect import build_schema
from ..metadata import MetadataStore, bootstrap_schema, to_json, to_markdown

router = APIRouter()


@router.post("/bootstrap")
def bootstrap(connection_id: str) -> dict:
    with get_connection(connection_id, timeout=60, allow_writes_to_schema="sqlutil") as c:
        bootstrap_schema(c)
    return {"ok": True}


class TableMetaIn(BaseModel):
    description: str | None = None
    owner: str | None = None
    domain: str | None = None
    source_of_truth_url: str | None = None
    llm_include: bool | None = None
    tags: list[str] | None = None


class ColumnMetaIn(BaseModel):
    description: str | None = None
    sample_values: str | None = None
    sensitivity: str | None = None
    glossary_term: str | None = None
    llm_include: bool | None = None
    tags: list[str] | None = None


@router.get("/tables/{schema_name}/{table_name}")
def get_table_meta(connection_id: str, schema_name: str, table_name: str) -> dict:
    with get_connection(connection_id) as c:
        store = MetadataStore(c)
        meta = store.get_table_meta(schema_name, table_name)
        cols = store.list_column_meta(schema_name, table_name)
    return {"table": meta, "columns": cols}


@router.put("/tables/{schema_name}/{table_name}")
def upsert_table_meta(
    connection_id: str,
    schema_name: str,
    table_name: str,
    body: TableMetaIn,
    x_user: str | None = Header(default=None),
) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    with get_connection(connection_id, allow_writes_to_schema="sqlutil") as c:
        store = MetadataStore(c)
        return store.upsert_table_meta(schema_name, table_name, patch, x_user)


@router.put("/tables/{schema_name}/{table_name}/columns/{column_name}")
def upsert_column_meta(
    connection_id: str,
    schema_name: str,
    table_name: str,
    column_name: str,
    body: ColumnMetaIn,
    x_user: str | None = Header(default=None),
) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    with get_connection(connection_id, allow_writes_to_schema="sqlutil") as c:
        store = MetadataStore(c)
        return store.upsert_column_meta(schema_name, table_name, column_name, patch, x_user)


@router.get("/export")
def export(
    connection_id: str,
    format: str = Query(default="json", pattern="^(json|markdown)$"),
    include_excluded: bool = Query(default=False),
) -> dict:
    with get_connection(connection_id, timeout=60) as c:
        schema = build_schema(c)
        store = MetadataStore(c)
        tm = store.list_table_meta()
        # gather columns for all tables
        cm: list[dict] = []
        for t in schema.table_list():
            cm.extend(store.list_column_meta(t.schema, t.name))
        db_name_row = c.fetch_one("SELECT DB_NAME() AS db")
    db_name = (db_name_row or {}).get("db") or "database"
    doc = to_json(schema, tm, cm, database_name=db_name, include_excluded=include_excluded)
    if format == "json":
        return doc
    return {"format": "markdown", "body": to_markdown(doc)}
