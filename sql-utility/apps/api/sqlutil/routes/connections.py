from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import build_connection_url, get_connection, get_store

router = APIRouter()


class ConnectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    host: str
    port: int = 1433
    database: str
    username: str
    password: str
    driver: str = "ODBC Driver 18 for SQL Server"
    trust_server_certificate: bool = True
    encrypt: bool = True


class ConnectionPatch(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    driver: str | None = None
    trust_server_certificate: bool | None = None
    encrypt: bool | None = None


@router.get("")
def list_connections() -> list[dict]:
    return get_store().list_connections()


@router.post("", status_code=201)
def create_connection(body: ConnectionIn) -> dict:
    return get_store().create_connection(body.model_dump())


@router.get("/{connection_id}")
def get_conn(connection_id: str) -> dict:
    c = get_store().get_connection(connection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="connection not found")
    return c


@router.patch("/{connection_id}")
def update_conn(connection_id: str, body: ConnectionPatch) -> dict:
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    c = get_store().update_connection(connection_id, patch)
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{connection_id}/permissions")
def permissions(connection_id: str) -> dict:
    """Return a best-effort summary of the login's effective permissions.

    Used by the UI to warn when the connecting user is `sysadmin`/`db_owner`.
    """
    with get_connection(connection_id, timeout=10) as c:
        ident = c.fetch_one("SELECT SUSER_SNAME() AS login, CURRENT_USER AS db_user")
        is_sysadmin = c.fetch_one("SELECT IS_SRVROLEMEMBER('sysadmin') AS v")
        is_dbowner = c.fetch_one("SELECT IS_MEMBER('db_owner') AS v")
        is_ddladmin = c.fetch_one("SELECT IS_MEMBER('db_ddladmin') AS v")
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
