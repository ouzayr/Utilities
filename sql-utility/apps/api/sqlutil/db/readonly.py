"""Read-only SQL enforcement helpers.

Validating that a user-supplied batch is read-only is deceptively tricky:
  * Multi-statement batches — `SELECT 1; DROP TABLE foo` is two statements.
  * Comments — `/* */ DROP TABLE foo` or `-- x\\nDROP TABLE foo`.
  * Quoted strings and bracketed identifiers that legitimately contain
    comment sequences or semicolons.

This module strips comments, splits on top-level semicolons while respecting
string / identifier quoting, and then checks each resulting statement against
an allow-list of leading keywords. It is used both by the ad-hoc query
playground and by the connection wrapper's write guard.
"""

from __future__ import annotations

import re

# Statements that never write user data. Everything else is treated as a write.
_READ_LEADERS = {
    "SELECT",
    "WITH",
    "SHOW",
    "DECLARE",  # benign on its own; the batched statements still get validated
    "SET",  # SET SHOWPLAN_XML ON etc. — session-local, no user-data writes
    "USE",
    "PRINT",
    "VALUES",
}

# Statements we know touch data or schema. Listed explicitly so future SQL
# Server keywords don't silently pass the filter.
_WRITE_LEADERS = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "TRUNCATE",
    "DROP",
    "ALTER",
    "CREATE",
    "EXEC",
    "EXECUTE",
    "GRANT",
    "REVOKE",
    "DENY",
    "BACKUP",
    "RESTORE",
    "BULK",
    "DBCC",
    "RENAME",
    "DISABLE",
    "ENABLE",
}


def strip_comments(sql: str) -> str:
    """Remove SQL comments while preserving string / identifier literals.

    Handles `-- line` comments, `/* ... */` block comments (non-nested —
    T-SQL does not support nested block comments), and leaves `'...'`,
    `"..."` and `[...]` runs untouched.
    """
    out: list[str] = []
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        # Line comment
        if ch == "-" and nxt == "-":
            end = sql.find("\n", i)
            if end == -1:
                break
            i = end  # keep the newline so line numbers stay sensible
            continue

        # Block comment
        if ch == "/" and nxt == "*":
            end = sql.find("*/", i + 2)
            if end == -1:
                break
            i = end + 2
            continue

        # Single-quoted string (T-SQL doubles the quote to escape)
        if ch == "'":
            out.append(ch)
            i += 1
            while i < n:
                out.append(sql[i])
                if sql[i] == "'":
                    if i + 1 < n and sql[i + 1] == "'":
                        out.append(sql[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        # Double-quoted identifier
        if ch == '"':
            out.append(ch)
            i += 1
            while i < n:
                out.append(sql[i])
                if sql[i] == '"':
                    i += 1
                    break
                i += 1
            continue

        # Bracketed identifier  [foo]]bar]
        if ch == "[":
            out.append(ch)
            i += 1
            while i < n:
                out.append(sql[i])
                if sql[i] == "]":
                    if i + 1 < n and sql[i + 1] == "]":
                        out.append(sql[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def split_statements(sql: str) -> list[str]:
    """Split a batch on top-level semicolons, ignoring those inside quotes."""
    stripped = strip_comments(sql)
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(stripped)
    while i < n:
        ch = stripped[i]

        if ch == "'":
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(stripped[i])
                if stripped[i] == "'":
                    if i + 1 < n and stripped[i + 1] == "'":
                        buf.append(stripped[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        if ch == '"':
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(stripped[i])
                if stripped[i] == '"':
                    i += 1
                    break
                i += 1
            continue

        if ch == "[":
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(stripped[i])
                if stripped[i] == "]":
                    if i + 1 < n and stripped[i + 1] == "]":
                        buf.append(stripped[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


_LEADING_KEYWORD_RX = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)")


def leading_keyword(stmt: str) -> str:
    m = _LEADING_KEYWORD_RX.match(stmt)
    return m.group(1).upper() if m else ""


class WriteAttemptError(ValueError):
    """Raised when a SQL batch contains a statement that would write data."""

    def __init__(self, message: str, *, statement: str = "", keyword: str = ""):
        super().__init__(message)
        self.statement = statement
        self.keyword = keyword


def assert_read_only(sql: str) -> list[str]:
    """Validate that every statement in `sql` is read-only.

    Returns the list of parsed statements on success. Raises
    :class:`WriteAttemptError` on the first write encountered.
    """
    statements = split_statements(sql)
    if not statements:
        raise WriteAttemptError("empty SQL batch")
    for stmt in statements:
        kw = leading_keyword(stmt)
        if not kw:
            raise WriteAttemptError("statement has no leading keyword", statement=stmt)
        if kw in _WRITE_LEADERS or kw not in _READ_LEADERS:
            raise WriteAttemptError(
                f"write statement `{kw}` is not permitted in read-only context",
                statement=stmt,
                keyword=kw,
            )
    return statements
