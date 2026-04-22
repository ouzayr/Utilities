"""Local app store for saved connections and app-side settings.

Uses SQLite so saved connections persist across runs without touching the user's DB.
Secrets (password) are encrypted at rest with Fernet.
"""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from typing import Iterator

from ..config import settings
from ..crypto import decrypt, encrypt


SCHEMA = """
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 1433,
    database TEXT NOT NULL,
    username TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    driver TEXT NOT NULL DEFAULT 'ODBC Driver 18 for SQL Server',
    trust_server_certificate INTEGER NOT NULL DEFAULT 1,
    encrypt INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);
"""


class AppStore:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or str(settings.app_db_path)

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def migrate(self) -> None:
        with self._conn() as c:
            c.executescript(SCHEMA)

    # ---- connections ---------------------------------------------------

    def list_connections(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT id, name, host, port, database, username, driver, "
                "trust_server_certificate, encrypt, created_at, updated_at FROM connections "
                "ORDER BY name"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_connection(self, conn_id: str, *, with_password: bool = False) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM connections WHERE id = ?", (conn_id,)).fetchone()
            if row is None:
                return None
            d = dict(row)
            if with_password:
                d["password"] = decrypt(d["password_enc"])
            d.pop("password_enc", None)
            return d

    def create_connection(self, data: dict) -> dict:
        cid = str(uuid.uuid4())
        now = int(time.time())
        pw_enc = encrypt(data["password"])
        with self._conn() as c:
            c.execute(
                "INSERT INTO connections (id, name, host, port, database, username, password_enc, "
                "driver, trust_server_certificate, encrypt, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    cid,
                    data["name"],
                    data["host"],
                    int(data.get("port", 1433)),
                    data["database"],
                    data["username"],
                    pw_enc,
                    data.get("driver", "ODBC Driver 18 for SQL Server"),
                    1 if data.get("trust_server_certificate", True) else 0,
                    1 if data.get("encrypt", True) else 0,
                    now,
                    now,
                ),
            )
        got = self.get_connection(cid)
        assert got is not None
        return got

    def update_connection(self, conn_id: str, data: dict) -> dict | None:
        current = self.get_connection(conn_id, with_password=True)
        if current is None:
            return None
        merged = {**current, **data}
        pw_enc = encrypt(merged["password"])
        now = int(time.time())
        with self._conn() as c:
            c.execute(
                "UPDATE connections SET name=?, host=?, port=?, database=?, username=?, "
                "password_enc=?, driver=?, trust_server_certificate=?, encrypt=?, updated_at=? "
                "WHERE id=?",
                (
                    merged["name"],
                    merged["host"],
                    int(merged["port"]),
                    merged["database"],
                    merged["username"],
                    pw_enc,
                    merged.get("driver", "ODBC Driver 18 for SQL Server"),
                    1 if merged.get("trust_server_certificate", True) else 0,
                    1 if merged.get("encrypt", True) else 0,
                    now,
                    conn_id,
                ),
            )
        return self.get_connection(conn_id)

    def delete_connection(self, conn_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM connections WHERE id = ?", (conn_id,))
            return cur.rowcount > 0

    # ---- snapshots -----------------------------------------------------

    def save_snapshot(self, connection_id: str, kind: str, payload: dict) -> str:
        sid = str(uuid.uuid4())
        with self._conn() as c:
            c.execute(
                "INSERT INTO snapshots (id, connection_id, created_at, kind, payload) VALUES (?, ?, ?, ?, ?)",
                (sid, connection_id, int(time.time()), kind, json.dumps(payload)),
            )
        return sid

    def list_snapshots(self, connection_id: str, kind: str | None = None) -> list[dict]:
        with self._conn() as c:
            if kind:
                rows = c.execute(
                    "SELECT id, kind, created_at FROM snapshots WHERE connection_id = ? AND kind = ? "
                    "ORDER BY created_at DESC",
                    (connection_id, kind),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT id, kind, created_at FROM snapshots WHERE connection_id = ? ORDER BY created_at DESC",
                    (connection_id,),
                ).fetchall()
            return [dict(r) for r in rows]


_store: AppStore | None = None


def get_store() -> AppStore:
    global _store
    if _store is None:
        _store = AppStore()
        _store.migrate()
    return _store
