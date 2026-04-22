"""Local app store for saved connections and app-side settings.

Uses SQLite so saved connections persist across runs without touching the user's DB.
Secrets (password) are encrypted at rest with Fernet.
"""

from __future__ import annotations

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
    port INTEGER,
    instance TEXT,
    database TEXT NOT NULL,
    auth_mode TEXT NOT NULL DEFAULT 'sql',
    username TEXT,
    password_enc TEXT,
    driver TEXT NOT NULL DEFAULT 'ODBC Driver 18 for SQL Server',
    trust_server_certificate INTEGER NOT NULL DEFAULT 1,
    encrypt INTEGER NOT NULL DEFAULT 1,
    extra_params TEXT,
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


# Columns added to the connections table after initial release; for existing
# installs we add them idempotently on migrate().
_EXPECTED_COLUMNS: dict[str, str] = {
    "instance": "TEXT",
    "auth_mode": "TEXT NOT NULL DEFAULT 'sql'",
    "extra_params": "TEXT",
}


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
            existing = {
                row["name"] for row in c.execute("PRAGMA table_info(connections)").fetchall()
            }
            for col, ddl in _EXPECTED_COLUMNS.items():
                if col not in existing:
                    c.execute(f"ALTER TABLE connections ADD COLUMN {col} {ddl}")

    # ---- connections ---------------------------------------------------

    _PUBLIC_COLS = (
        "id, name, host, port, instance, database, auth_mode, username, driver, "
        "trust_server_certificate, encrypt, extra_params, created_at, updated_at"
    )

    def list_connections(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                f"SELECT {self._PUBLIC_COLS} FROM connections ORDER BY name"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_connection(self, conn_id: str, *, with_password: bool = False) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM connections WHERE id = ?", (conn_id,)).fetchone()
            if row is None:
                return None
            d = dict(row)
            if with_password:
                pw_enc = d.get("password_enc")
                d["password"] = decrypt(pw_enc) if pw_enc else ""
            d.pop("password_enc", None)
            return d

    def create_connection(self, data: dict) -> dict:
        cid = str(uuid.uuid4())
        now = int(time.time())
        pw_enc = encrypt(data["password"]) if data.get("password") else None
        with self._conn() as c:
            c.execute(
                "INSERT INTO connections (id, name, host, port, instance, database, "
                "auth_mode, username, password_enc, driver, trust_server_certificate, "
                "encrypt, extra_params, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    cid,
                    data["name"],
                    data["host"],
                    int(data["port"]) if data.get("port") else None,
                    data.get("instance"),
                    data["database"],
                    data.get("auth_mode", "sql"),
                    data.get("username"),
                    pw_enc,
                    data.get("driver", "ODBC Driver 18 for SQL Server"),
                    1 if data.get("trust_server_certificate", True) else 0,
                    1 if data.get("encrypt", True) else 0,
                    data.get("extra_params"),
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
        pw = merged.get("password")
        pw_enc = encrypt(pw) if pw else None
        now = int(time.time())
        with self._conn() as c:
            c.execute(
                "UPDATE connections SET name=?, host=?, port=?, instance=?, database=?, "
                "auth_mode=?, username=?, password_enc=?, driver=?, "
                "trust_server_certificate=?, encrypt=?, extra_params=?, updated_at=? "
                "WHERE id=?",
                (
                    merged["name"],
                    merged["host"],
                    int(merged["port"]) if merged.get("port") else None,
                    merged.get("instance"),
                    merged["database"],
                    merged.get("auth_mode", "sql"),
                    merged.get("username"),
                    pw_enc,
                    merged.get("driver", "ODBC Driver 18 for SQL Server"),
                    1 if merged.get("trust_server_certificate", True) else 0,
                    1 if merged.get("encrypt", True) else 0,
                    merged.get("extra_params"),
                    now,
                    conn_id,
                ),
            )
        return self.get_connection(conn_id)

    def delete_connection(self, conn_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM connections WHERE id = ?", (conn_id,))
            return cur.rowcount > 0


_store: AppStore | None = None


def get_store() -> AppStore:
    global _store
    if _store is None:
        _store = AppStore()
    return _store
