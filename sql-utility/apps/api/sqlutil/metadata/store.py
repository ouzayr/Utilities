"""Metadata persisted in a dedicated schema inside the target database.

Tables:
  [sqlutil].table_meta    -- one row per table
  [sqlutil].column_meta   -- one row per (table, column)
  [sqlutil].tags          -- m:n tags for tables / columns

The schema + role are created on bootstrap; after that, the tool writes to
these three tables only.
"""

from __future__ import annotations

import json
from typing import Any

from ..config import settings
from ..db.mssql import MssqlConnection


def _qualified(name: str) -> str:
    return f"[{settings.metadata_schema}].[{name}]"


BOOTSTRAP_SQL = f"""
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'{settings.metadata_schema}')
    EXEC('CREATE SCHEMA [{settings.metadata_schema}]');
"""

CREATE_TABLES = [
    f"""
    IF OBJECT_ID(N'{_qualified("table_meta")}', 'U') IS NULL
    CREATE TABLE {_qualified("table_meta")} (
        schema_name    nvarchar(128) NOT NULL,
        table_name     nvarchar(128) NOT NULL,
        description    nvarchar(max) NULL,
        owner          nvarchar(256) NULL,
        domain         nvarchar(128) NULL,
        llm_include    bit           NOT NULL CONSTRAINT DF_sqlutil_table_meta_llm DEFAULT (1),
        source_of_truth_url nvarchar(1024) NULL,
        tags_json      nvarchar(max) NULL,
        updated_at     datetime2(3)  NOT NULL CONSTRAINT DF_sqlutil_table_meta_updated DEFAULT (SYSUTCDATETIME()),
        updated_by     nvarchar(256) NULL,
        CONSTRAINT PK_sqlutil_table_meta PRIMARY KEY (schema_name, table_name)
    );""",
    f"""
    IF OBJECT_ID(N'{_qualified("column_meta")}', 'U') IS NULL
    CREATE TABLE {_qualified("column_meta")} (
        schema_name    nvarchar(128) NOT NULL,
        table_name     nvarchar(128) NOT NULL,
        column_name    nvarchar(128) NOT NULL,
        description    nvarchar(max) NULL,
        sample_values  nvarchar(max) NULL,
        sensitivity    nvarchar(64)  NULL,
        llm_include    bit           NOT NULL CONSTRAINT DF_sqlutil_column_meta_llm DEFAULT (1),
        glossary_term  nvarchar(256) NULL,
        tags_json      nvarchar(max) NULL,
        updated_at     datetime2(3)  NOT NULL CONSTRAINT DF_sqlutil_column_meta_updated DEFAULT (SYSUTCDATETIME()),
        updated_by     nvarchar(256) NULL,
        CONSTRAINT PK_sqlutil_column_meta PRIMARY KEY (schema_name, table_name, column_name)
    );""",
]


def bootstrap_schema(conn: MssqlConnection) -> None:
    conn.execute(BOOTSTRAP_SQL)
    for stmt in CREATE_TABLES:
        conn.execute(stmt)
    conn.commit()


class MetadataStore:
    def __init__(self, conn: MssqlConnection) -> None:
        self.conn = conn

    # ---- table metadata ------------------------------------------------

    def get_table_meta(self, schema: str, table: str) -> dict | None:
        return self.conn.fetch_one(
            f"SELECT * FROM {_qualified('table_meta')} WHERE schema_name=? AND table_name=?",
            (schema, table),
        )

    def list_table_meta(self) -> list[dict]:
        return self.conn.fetch_all(f"SELECT * FROM {_qualified('table_meta')}")

    def upsert_table_meta(self, schema: str, table: str, patch: dict, user: str | None) -> dict:
        tags_json = json.dumps(patch["tags"]) if "tags" in patch else None
        existing = self.get_table_meta(schema, table)
        merged: dict[str, Any] = dict(existing or {})
        for k in ("description", "owner", "domain", "source_of_truth_url"):
            if k in patch:
                merged[k] = patch[k]
        if "llm_include" in patch:
            merged["llm_include"] = 1 if patch["llm_include"] else 0
        if tags_json is not None:
            merged["tags_json"] = tags_json

        if existing is None:
            self.conn.execute(
                f"INSERT INTO {_qualified('table_meta')} "
                "(schema_name, table_name, description, owner, domain, llm_include, "
                "source_of_truth_url, tags_json, updated_at, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME(), ?)",
                (
                    schema,
                    table,
                    merged.get("description"),
                    merged.get("owner"),
                    merged.get("domain"),
                    merged.get("llm_include", 1),
                    merged.get("source_of_truth_url"),
                    merged.get("tags_json"),
                    user,
                ),
            )
        else:
            self.conn.execute(
                f"UPDATE {_qualified('table_meta')} SET "
                "description=?, owner=?, domain=?, llm_include=?, source_of_truth_url=?, "
                "tags_json=?, updated_at=SYSUTCDATETIME(), updated_by=? "
                "WHERE schema_name=? AND table_name=?",
                (
                    merged.get("description"),
                    merged.get("owner"),
                    merged.get("domain"),
                    merged.get("llm_include", 1),
                    merged.get("source_of_truth_url"),
                    merged.get("tags_json"),
                    user,
                    schema,
                    table,
                ),
            )
        self.conn.commit()
        return self.get_table_meta(schema, table) or {}

    # ---- column metadata ----------------------------------------------

    def list_column_meta(self, schema: str, table: str) -> list[dict]:
        return self.conn.fetch_all(
            f"SELECT * FROM {_qualified('column_meta')} WHERE schema_name=? AND table_name=?",
            (schema, table),
        )

    def upsert_column_meta(
        self, schema: str, table: str, column: str, patch: dict, user: str | None
    ) -> dict:
        tags_json = json.dumps(patch["tags"]) if "tags" in patch else None
        existing = self.conn.fetch_one(
            f"SELECT * FROM {_qualified('column_meta')} "
            "WHERE schema_name=? AND table_name=? AND column_name=?",
            (schema, table, column),
        )
        merged: dict[str, Any] = dict(existing or {})
        for k in ("description", "sample_values", "sensitivity", "glossary_term"):
            if k in patch:
                merged[k] = patch[k]
        if "llm_include" in patch:
            merged["llm_include"] = 1 if patch["llm_include"] else 0
        if tags_json is not None:
            merged["tags_json"] = tags_json

        if existing is None:
            self.conn.execute(
                f"INSERT INTO {_qualified('column_meta')} "
                "(schema_name, table_name, column_name, description, sample_values, sensitivity, "
                "llm_include, glossary_term, tags_json, updated_at, updated_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME(), ?)",
                (
                    schema,
                    table,
                    column,
                    merged.get("description"),
                    merged.get("sample_values"),
                    merged.get("sensitivity"),
                    merged.get("llm_include", 1),
                    merged.get("glossary_term"),
                    merged.get("tags_json"),
                    user,
                ),
            )
        else:
            self.conn.execute(
                f"UPDATE {_qualified('column_meta')} SET "
                "description=?, sample_values=?, sensitivity=?, llm_include=?, "
                "glossary_term=?, tags_json=?, updated_at=SYSUTCDATETIME(), updated_by=? "
                "WHERE schema_name=? AND table_name=? AND column_name=?",
                (
                    merged.get("description"),
                    merged.get("sample_values"),
                    merged.get("sensitivity"),
                    merged.get("llm_include", 1),
                    merged.get("glossary_term"),
                    merged.get("tags_json"),
                    user,
                    schema,
                    table,
                    column,
                ),
            )
        self.conn.commit()
        return self.conn.fetch_one(
            f"SELECT * FROM {_qualified('column_meta')} "
            "WHERE schema_name=? AND table_name=? AND column_name=?",
            (schema, table, column),
        ) or {}
