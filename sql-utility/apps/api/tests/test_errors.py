"""Unit tests for the error classifier."""

from __future__ import annotations

import sqlite3

import pytest

from sqlutil.db.errors import classify_error


@pytest.mark.parametrize(
    ("raw", "expected_kind"),
    [
        ("[IM002] [Microsoft][ODBC Driver Manager] Data source name not found", "odbc_driver_missing"),
        ("can't open lib 'ODBC Driver 18 for SQL Server'", "odbc_driver_missing"),
        (
            "[08001] [Microsoft][ODBC Driver 18 for SQL Server]TCP Provider, error: 0 - "
            "No connection could be made because the target machine actively refused it.",
            "tcp_refused",
        ),
        ("Login timeout expired", "tcp_refused"),
        (
            "[08001] SQL Server Network Interfaces, error: 26 - Error Locating Server/Instance Specified",
            "named_instance_unreachable",
        ),
        ("Login failed for user 'sqlutil_reader'. (18456)", "login_failed"),
        ("Cannot open database \"Foo\" requested by the login. (4060)", "database_not_accessible"),
        (
            "The certificate chain was issued by an authority that is not trusted",
            "cert_not_trusted",
        ),
        ("Some random pyodbc error we don't know about", "unknown"),
    ],
)
def test_classify_known_patterns(raw: str, expected_kind: str) -> None:
    info = classify_error(RuntimeError(raw))
    assert info.kind == expected_kind
    assert info.summary and info.hint
    assert info.raw == raw


def test_classify_duplicate_name() -> None:
    exc = sqlite3.IntegrityError("UNIQUE constraint failed: connections.name")
    info = classify_error(exc)
    assert info.kind == "duplicate_name"
    assert "already exists" in info.summary


def test_classify_generic_sqlite_integrity() -> None:
    exc = sqlite3.IntegrityError("CHECK constraint failed: something")
    info = classify_error(exc)
    assert info.kind == "local_store"
