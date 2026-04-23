"""SQL Server connection helpers.

We intentionally avoid SQLAlchemy ORM here — introspection is read-heavy and the
queries are dialect-specific, so a thin pyodbc wrapper gives us clearer control
over parameter binding, timeouts, and read-only enforcement.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import pyodbc

from .app_store import get_store
from .readonly import WriteAttemptError, assert_read_only, leading_keyword, split_statements


def build_connection_url(conn: dict, *, password: str) -> str:
    """Build a pyodbc connection string from a saved-connection dict.

    Supports:
      * default TCP port (e.g. `localhost,1433`) — set `port`, leave `instance` null.
      * named instances (e.g. `.\\SQLEXPRESS`)  — set `instance`, port is optional.
      * SQL auth                                 — auth_mode="sql", username/password.
      * Windows auth (Trusted_Connection=yes)    — auth_mode="windows", no user/pw.
      * extra_params                             — raw ODBC key=val;... appended verbatim.
    """
    host = conn["host"]
    instance = (conn.get("instance") or "").strip()
    port = conn.get("port")

    if instance:
        server = rf"{host}\{instance}"
        if port:
            server = f"{server},{port}"
    else:
        server = f"{host},{port}" if port else host

    parts = [
        f"DRIVER={{{conn.get('driver', 'ODBC Driver 18 for SQL Server')}}}",
        f"SERVER={server}",
        f"DATABASE={conn['database']}",
    ]

    auth_mode = (conn.get("auth_mode") or "sql").lower()
    if auth_mode == "windows":
        parts.append("Trusted_Connection=yes")
    else:
        username = conn.get("username") or ""
        parts.append(f"UID={username}")
        parts.append(f"PWD={password}")

    parts.extend(
        [
            f"Encrypt={'yes' if conn.get('encrypt', True) else 'no'}",
            f"TrustServerCertificate={'yes' if conn.get('trust_server_certificate', True) else 'no'}",
            "Application Name=sqlutil",
        ]
    )

    extra = (conn.get("extra_params") or "").strip().strip(";")
    if extra:
        parts.append(extra)

    return ";".join(parts) + ";"


class MssqlConnection:
    """Thin wrapper around a pyodbc connection with read-only-by-default semantics.

    The wrapper tracks whether a statement is a write, and by default refuses to
    execute writes outside of the metadata schema. This is a belt-and-braces
    guard in addition to using a narrowly-scoped SQL login.
    """

    def __init__(self, pyodbc_conn: pyodbc.Connection, *, allow_writes_to_schema: str | None = None):
        self._conn = pyodbc_conn
        self._allow_writes_to_schema = allow_writes_to_schema

    def _guard(self, sql: str) -> None:
        """Reject write statements unless the caller opted into a schema.

        When `allow_writes_to_schema` is None, the whole batch must be
        read-only. When it is set, we require every write statement in the
        batch to reference `[<schema>]` — a cheap lexical check that blocks
        accidental cross-schema writes through this wrapper.
        """
        if self._allow_writes_to_schema is None:
            assert_read_only(sql)
            return

        target = f"[{self._allow_writes_to_schema}]".lower()
        for stmt in split_statements(sql):
            kw = leading_keyword(stmt)
            # Reads always allowed; SET / USE / DECLARE / PRINT are session-local.
            if kw in {"SELECT", "WITH", "VALUES", "SET", "USE", "DECLARE", "PRINT", "SHOW", "IF"}:
                continue
            # CREATE SCHEMA for the allowed schema is explicitly permitted.
            lowered = stmt.lower()
            if target in lowered or f"schema [{self._allow_writes_to_schema.lower()}]" in lowered:
                continue
            raise WriteAttemptError(
                f"write statement `{kw}` outside allowed schema "
                f"[{self._allow_writes_to_schema}]",
                statement=stmt,
                keyword=kw,
            )

    def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict]:
        self._guard(sql)
        cur = self._conn.cursor()
        cur.execute(sql, params)
        cols = [c[0] for c in cur.description] if cur.description else []
        return [dict(zip(cols, row, strict=False)) for row in cur.fetchall()]

    def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> dict | None:
        rows = self.fetch_all(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        self._guard(sql)
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return cur.rowcount

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


@contextmanager
def get_connection(
    connection_id: str,
    *,
    timeout: int = 30,
    allow_writes_to_schema: str | None = None,
) -> Iterator[MssqlConnection]:
    store = get_store()
    saved = store.get_connection(connection_id, with_password=True)
    if saved is None:
        raise LookupError(f"connection {connection_id} not found")
    url = build_connection_url(saved, password=saved["password"])
    raw = pyodbc.connect(url, timeout=timeout)
    raw.timeout = timeout
    wrapper = MssqlConnection(raw, allow_writes_to_schema=allow_writes_to_schema)
    try:
        yield wrapper
    finally:
        wrapper.close()
