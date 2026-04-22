"""Health + self-diagnostic endpoints.

Nothing here talks to the target SQL Server — it only reports on the API
host itself (drivers, data dir writability, encryption key). Used by the UI
to guide users through setup before they try to save a connection.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import APIRouter

from .. import __version__
from ..config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/health/odbc")
def health_odbc() -> dict:
    """Return the list of ODBC drivers visible to the API process.

    Empty list usually means the Microsoft ODBC Driver 18 isn't installed, or
    the API is running as a user that can't see the system-level registration
    (common when the API runs as a service).
    """
    drivers: list[str] = []
    error: str | None = None
    try:
        import pyodbc

        drivers = list(pyodbc.drivers())
    except Exception as e:  # noqa: BLE001
        error = str(e)

    has_v18 = any("18" in d and "SQL Server" in d for d in drivers)
    has_v17 = any("17" in d and "SQL Server" in d for d in drivers)
    return {
        "drivers": drivers,
        "preferred_driver_present": has_v18,
        "has_v18": has_v18,
        "has_v17": has_v17,
        "error": error,
    }


@router.get("/health/setup")
def health_setup() -> dict:
    """Surface the three things that most often cause a 500 on connection save."""
    data_dir = settings.data_dir
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        probe = data_dir / ".probe"
        probe.write_text("ok")
        probe.unlink()
        data_dir_writable = True
        data_dir_err: str | None = None
    except Exception as e:  # noqa: BLE001
        data_dir_writable = False
        data_dir_err = str(e)

    enc_key_set = bool(os.environ.get(settings.encryption_key_env))
    secret_file = data_dir / "secret.key"

    return {
        "python": sys.version,
        "platform": sys.platform,
        "data_dir": str(data_dir),
        "data_dir_writable": data_dir_writable,
        "data_dir_error": data_dir_err,
        "encryption_env_set": enc_key_set,
        "encryption_key_file_present": secret_file.exists(),
        "app_db_path": str(settings.app_db_path) if data_dir_writable else None,
        "hint": (
            None
            if data_dir_writable
            else f"The API cannot write to {data_dir}. Set SQLUTIL_DATA_DIR to a writable path."
        ),
    }


__all__ = ["router"]


# Keep a simple local reference so imports survive even without Path usage.
_ = Path
