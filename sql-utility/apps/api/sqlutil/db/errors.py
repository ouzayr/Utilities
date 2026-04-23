"""Classify SQL Server / pyodbc / local-store errors into actionable messages.

The goal is that a user reading the UI knows *what to do next* without having
to read a raw ODBC error string. Every classification returns a `kind` (stable
identifier the UI can branch on), a short `summary`, a `hint` (one-line fix),
and the raw message.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass


@dataclass
class ErrorInfo:
    kind: str
    summary: str
    hint: str
    raw: str

    def as_detail(self) -> dict:
        return {"kind": self.kind, "summary": self.summary, "hint": self.hint, "raw": self.raw}


# SQLSTATE / error-number patterns we recognise. We check substrings (case
# insensitive) against the raw `str(exc)` since pyodbc already formats them in
# a predictable `[state] [driver] message (number)` shape.

_DRIVER_MISSING = (
    "im002",                            # SQLSTATE: data source not found
    "can't open lib",                   # macOS/Linux: driver file missing
    "libodbc",                          # libodbc not found
    "data source name not found",
    "im014",                            # driver's odbc version does not match
)

_TCP_REFUSED = (
    "tcp provider, error: 0",           # classic "can't connect" preamble
    "tcp provider: no connection could be made",  # Windows
    "connection refused",
    "could not open a connection to sql server",
    "timeout expired",
    "login timeout expired",
)

_INSTANCE_NOT_FOUND = (
    "sql server network interfaces, error: 26",   # named instance unreachable
    "sql browser",
    "does not exist or access denied",
)

_LOGIN_FAILED = (
    "login failed for user",
    "18456",                            # MSSQL error code for login failed
)

_DB_NOT_ACCESSIBLE = (
    "cannot open database",
    "cannot open server",
    "4060",                             # cannot open database
)

_CERT_NOT_TRUSTED = (
    "certificate chain was issued by an authority that is not trusted",
    "ssl provider",
    "hy000",
    "self signed certificate",
    "certificate verify failed",
)

_ENCRYPT_REQUIRED = (
    "a connection was successfully established with the server, but then an error occurred during the pre-login handshake",
    "encryption",
)


def _has(needles: tuple[str, ...], haystack: str) -> bool:
    return any(n in haystack for n in needles)


def classify_error(exc: Exception) -> ErrorInfo:
    raw = str(exc)
    lower = raw.lower()

    if isinstance(exc, sqlite3.IntegrityError):
        if "UNIQUE" in raw and "connections.name" in raw:
            return ErrorInfo(
                kind="duplicate_name",
                summary="A connection with this name already exists.",
                hint="Pick a different display name or delete the old one.",
                raw=raw,
            )
        return ErrorInfo(
            kind="local_store",
            summary="Local app database error.",
            hint="Delete ~/.sqlutil/app.db and retry if this persists.",
            raw=raw,
        )

    if _has(_DRIVER_MISSING, lower):
        return ErrorInfo(
            kind="odbc_driver_missing",
            summary="ODBC Driver 18 for SQL Server is not installed on the API host.",
            hint=(
                "Install from "
                "https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server "
                "then restart the API."
            ),
            raw=raw,
        )

    if _has(_INSTANCE_NOT_FOUND, lower):
        return ErrorInfo(
            kind="named_instance_unreachable",
            summary="Named instance could not be resolved (SQL Browser error 26).",
            hint=(
                "Either start the SQL Server Browser service and allow UDP 1434, or "
                "set a fixed TCP port in Configuration Manager and put it in the Port field."
            ),
            raw=raw,
        )

    if _has(_TCP_REFUSED, lower):
        return ErrorInfo(
            kind="tcp_refused",
            summary="Could not reach the SQL Server over TCP.",
            hint=(
                "Check: (1) TCP/IP is enabled on the SQLEXPRESS instance, (2) the port "
                "matches IPAll → TCP Port in Configuration Manager, (3) Windows Firewall "
                "allows the port, (4) the SQL Server service is running."
            ),
            raw=raw,
        )

    if _has(_LOGIN_FAILED, lower):
        return ErrorInfo(
            kind="login_failed",
            summary="SQL Server rejected the login.",
            hint=(
                "Check the username/password. If using SQL auth, the server must be in "
                "Mixed-Mode ('SQL Server and Windows Authentication') — restart required "
                "after changing. The login also needs a user mapped in the target database."
            ),
            raw=raw,
        )

    if _has(_DB_NOT_ACCESSIBLE, lower):
        return ErrorInfo(
            kind="database_not_accessible",
            summary="The login can't open the specified database.",
            hint=(
                "Verify the Database field is spelled correctly and that the login has a "
                "user in that DB with at least db_datareader."
            ),
            raw=raw,
        )

    if _has(_CERT_NOT_TRUSTED, lower):
        return ErrorInfo(
            kind="cert_not_trusted",
            summary="TLS certificate is not trusted by the client.",
            hint="Enable 'Trust server cert' on the connection (default).",
            raw=raw,
        )

    if _has(_ENCRYPT_REQUIRED, lower):
        return ErrorInfo(
            kind="encryption_mismatch",
            summary="Encryption / pre-login handshake failed.",
            hint="Toggle 'Encrypt' and 'Trust server cert' off/on and retry.",
            raw=raw,
        )

    return ErrorInfo(
        kind="unknown",
        summary="Unclassified error connecting to SQL Server.",
        hint="See the raw error message for details.",
        raw=raw,
    )
