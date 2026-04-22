"""Tests for connection string building and the /connections routes.

No live SQL Server required — pyodbc.connect() is monkey-patched when needed.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sqlutil.db import build_connection_url
from sqlutil.db.app_store import AppStore


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    tmp = Path(tempfile.mkdtemp(prefix="sqlutil-test-"))
    monkeypatch.setenv("SQLUTIL_DATA_DIR", str(tmp))
    # Reload settings + store with the new data dir.
    from sqlutil import config as _cfg
    _cfg.settings = _cfg.Settings()
    from sqlutil.db import app_store as _as
    _as._store = None  # type: ignore[attr-defined]
    from sqlutil.main import app
    # Explicitly migrate — TestClient in recent FastAPI doesn't run on_event by default.
    _as.get_store().migrate()
    return TestClient(app)


# ---- build_connection_url -----------------------------------------------


def test_url_default_tcp_sql_auth() -> None:
    url = build_connection_url(
        {
            "host": "localhost",
            "port": 1433,
            "database": "db",
            "auth_mode": "sql",
            "username": "sa",
        },
        password="pw",
    )
    assert "SERVER=localhost,1433;" in url
    assert "DATABASE=db;" in url
    assert "UID=sa;" in url and "PWD=pw;" in url
    assert "Trusted_Connection" not in url


def test_url_named_instance_no_port() -> None:
    url = build_connection_url(
        {
            "host": "localhost",
            "port": None,
            "instance": "SQLEXPRESS",
            "database": "db",
            "auth_mode": "sql",
            "username": "sa",
        },
        password="pw",
    )
    assert r"SERVER=localhost\SQLEXPRESS;" in url
    # port left off so SQL Browser can resolve the dynamic port
    assert ",0" not in url and ",None" not in url


def test_url_named_instance_with_port() -> None:
    url = build_connection_url(
        {
            "host": "localhost",
            "port": 51234,
            "instance": "SQLEXPRESS",
            "database": "db",
            "auth_mode": "sql",
            "username": "sa",
        },
        password="pw",
    )
    assert r"SERVER=localhost\SQLEXPRESS,51234;" in url


def test_url_windows_auth_omits_uid_pwd() -> None:
    url = build_connection_url(
        {
            "host": "localhost",
            "instance": "SQLEXPRESS",
            "database": "db",
            "auth_mode": "windows",
        },
        password="",
    )
    assert "Trusted_Connection=yes" in url
    assert "UID=" not in url and "PWD=" not in url


def test_url_extra_params_appended() -> None:
    url = build_connection_url(
        {
            "host": "h",
            "port": 1433,
            "database": "db",
            "auth_mode": "sql",
            "username": "u",
            "extra_params": "MultiSubnetFailover=yes;ApplicationIntent=ReadOnly",
        },
        password="p",
    )
    assert "MultiSubnetFailover=yes" in url
    assert "ApplicationIntent=ReadOnly" in url


# ---- AppStore round-trip -------------------------------------------------


def test_app_store_round_trip_sql_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp = Path(tempfile.mkdtemp(prefix="sqlutil-test-"))
    monkeypatch.setenv("SQLUTIL_DATA_DIR", str(tmp))
    store = AppStore(db_path=str(tmp / "app.db"))
    store.migrate()
    saved = store.create_connection(
        {
            "name": "n1",
            "host": "localhost",
            "port": 1433,
            "database": "db",
            "auth_mode": "sql",
            "username": "u",
            "password": "p",
        }
    )
    with_pw = store.get_connection(saved["id"], with_password=True)
    assert with_pw is not None
    assert with_pw["password"] == "p"
    assert with_pw["auth_mode"] == "sql"
    assert with_pw["username"] == "u"


def test_app_store_round_trip_windows_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    tmp = Path(tempfile.mkdtemp(prefix="sqlutil-test-"))
    monkeypatch.setenv("SQLUTIL_DATA_DIR", str(tmp))
    store = AppStore(db_path=str(tmp / "app.db"))
    store.migrate()
    saved = store.create_connection(
        {
            "name": "winauth",
            "host": "localhost",
            "port": None,
            "instance": "SQLEXPRESS",
            "database": "db",
            "auth_mode": "windows",
        }
    )
    got = store.get_connection(saved["id"], with_password=True)
    assert got is not None
    assert got["auth_mode"] == "windows"
    assert got["username"] is None
    assert got["password"] == ""
    assert got["instance"] == "SQLEXPRESS"


# ---- /connections route --------------------------------------------------


def test_create_connection_rejects_missing_sql_credentials(client: TestClient) -> None:
    r = client.post(
        "/api/connections",
        json={"name": "x", "host": "localhost", "database": "db", "auth_mode": "sql"},
    )
    assert r.status_code == 422


def test_create_connection_accepts_windows_auth(client: TestClient) -> None:
    r = client.post(
        "/api/connections",
        json={
            "name": "winauth-api",
            "host": "localhost",
            "port": None,
            "instance": "SQLEXPRESS",
            "database": "db",
            "auth_mode": "windows",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["auth_mode"] == "windows"
    assert body["instance"] == "SQLEXPRESS"


def test_duplicate_name_returns_409(client: TestClient) -> None:
    payload = {
        "name": "dupe",
        "host": "localhost",
        "port": 1433,
        "database": "db",
        "auth_mode": "sql",
        "username": "sa",
        "password": "p",
    }
    r1 = client.post("/api/connections", json=payload)
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/connections", json=payload)
    assert r2.status_code == 409, r2.text
    detail = r2.json()["detail"]
    assert detail["kind"] == "duplicate_name"
    assert "already exists" in detail["summary"]


def test_health_odbc_endpoint(client: TestClient) -> None:
    r = client.get("/api/health/odbc")
    assert r.status_code == 200
    body = r.json()
    assert "drivers" in body
    assert "preferred_driver_present" in body


def test_health_setup_endpoint(client: TestClient) -> None:
    r = client.get("/api/health/setup")
    assert r.status_code == 200
    body = r.json()
    assert body["data_dir_writable"] is True
    assert body["app_db_path"].endswith("app.db")


def test_url_preview_masks_password(client: TestClient) -> None:
    r = client.post(
        "/api/connections",
        json={
            "name": "preview",
            "host": "localhost",
            "port": 1433,
            "database": "db",
            "auth_mode": "sql",
            "username": "sa",
            "password": "super-secret",
        },
    )
    assert r.status_code == 201
    cid = r.json()["id"]
    r2 = client.get(f"/api/connections/{cid}/url-preview")
    assert r2.status_code == 200
    assert "super-secret" not in r2.json()["url"]
    assert "PWD=***" in r2.json()["url"]


# ---- misc ---------------------------------------------------------------


def _noop():
    os.makedirs  # sanity
