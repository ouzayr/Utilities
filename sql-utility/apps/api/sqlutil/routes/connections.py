from __future__ import annotations

import logging
import sqlite3
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..db import build_connection_url, get_connection, get_store
from ..db.errors import classify_error

router = APIRouter()
log = logging.getLogger(__name__)


class ConnectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    host: str = Field(min_length=1)
    port: int | None = 1433
    instance: str | None = None
    database: str = Field(min_length=1)
    auth_mode: Literal["sql", "windows"] = "sql"
    username: str | None = None
    password: str | None = None
    driver: str = "ODBC Driver 18 for SQL Server"
    trust_server_certificate: bool = True
    encrypt: bool = True
    extra_params: str | None = None

    @model_validator(mode="after")
    def _auth_fields(self) -> "ConnectionIn":
        if self.auth_mode == "sql" and not (self.username and self.password):
            raise ValueError("SQL auth requires both username and password")
        if self.instance is not None and self.instance.strip() == "":
            self.instance = None
        return self


class ConnectionPatch(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    instance: str | None = None
    database: str | None = None
    auth_mode: Literal["sql", "windows"] | None = None
    username: str | None = None
    password: str | None = None
    driver: str | None = None
    trust_server_certificate: bool | None = None
    encrypt: bool | None = None
    extra_params: str | None = None


def _detail(exc: Exception) -> dict:
    """Structured error payload used by all connection routes."""
    return classify_error(exc).as_detail()


@router.get("")
def list_connections() -> list[dict]:
    return get_store().list_connections()


@router.post("", status_code=201)
def create_connection(body: ConnectionIn) -> dict:
    try:
        return get_store().create_connection(body.model_dump())
    except sqlite3.IntegrityError as e:
        raise HTTPException(status_code=409, detail=_detail(e)) from e
    except Exception as e:  # noqa: BLE001
        log.exception("create_connection failed")
        raise HTTPException(status_code=400, detail=_detail(e)) from e


@router.get("/{connection_id}")
def get_conn(connection_id: str) -> dict:
    c = get_store().get_connection(connection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="connection not found")
    return c


@router.patch("/{connection_id}")
def update_conn(connection_id: str, body: ConnectionPatch) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        c = get_store().update_connection(connection_id, patch)
    except Exception as e:  # noqa: BLE001
        log.exception("update_connection failed")
        raise HTTPException(status_code=400, detail=_detail(e)) from e
    if c is None:
        raise HTTPException(status_code=404, detail="connection not found")
    return c


@router.delete("/{connection_id}", status_code=204)
def delete_conn(connection_id: str) -> None:
    ok = get_store().delete_connection(connection_id)
    if not ok:
        raise HTTPException(status_code=404, detail="connection not found")


@router.post("/{connection_id}/test")
def test_conn(connection_id: str) -> dict:
    try:
        with get_connection(connection_id, timeout=5) as c:
            row = c.fetch_one("SELECT @@VERSION AS v, DB_NAME() AS db, CURRENT_USER AS usr")
        return {"ok": True, **(row or {})}
    except Exception as e:  # noqa: BLE001
        log.exception("test_conn failed")
        raise HTTPException(status_code=400, detail=_detail(e)) from e


@router.get("/{connection_id}/permissions")
def permissions(connection_id: str) -> dict:
    """Return a best-effort summary of the login's effective permissions.

    Used by the UI to warn when the connecting user is `sysadmin`/`db_owner`.
    """
    try:
        with get_connection(connection_id, timeout=10) as c:
            ident = c.fetch_one("SELECT SUSER_SNAME() AS login, CURRENT_USER AS db_user")
            is_sysadmin = c.fetch_one("SELECT IS_SRVROLEMEMBER('sysadmin') AS v")
            is_dbowner = c.fetch_one("SELECT IS_MEMBER('db_owner') AS v")
            is_ddladmin = c.fetch_one("SELECT IS_MEMBER('db_ddladmin') AS v")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=_detail(e)) from e
    return {
        "login": (ident or {}).get("login"),
        "db_user": (ident or {}).get("db_user"),
        "is_sysadmin": bool((is_sysadmin or {}).get("v")),
        "is_db_owner": bool((is_dbowner or {}).get("v")),
        "is_db_ddladmin": bool((is_ddladmin or {}).get("v")),
    }


@router.get("/{connection_id}/url-preview")
def url_preview(connection_id: str) -> dict:
    """Return the masked ODBC URL. Used mostly for debugging."""
    saved = get_store().get_connection(connection_id)
    if saved is None:
        raise HTTPException(status_code=404, detail="connection not found")
    url = build_connection_url(saved, password="***")
    return {"url": url}
