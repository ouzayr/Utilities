"""Tests for the read-only SQL guard used by the query playground."""

from __future__ import annotations

import pytest

from sqlutil.db.readonly import (
    WriteAttemptError,
    assert_read_only,
    split_statements,
    strip_comments,
)


def test_strip_line_and_block_comments() -> None:
    sql = "SELECT 1 -- trailing\nFROM t /* block */ WHERE x = 1"
    cleaned = strip_comments(sql)
    assert "--" not in cleaned
    assert "/*" not in cleaned
    assert "*/" not in cleaned
    assert "SELECT 1" in cleaned


def test_strip_comments_preserves_string_literals() -> None:
    sql = "SELECT '-- not a comment', '/* also not */' FROM t"
    cleaned = strip_comments(sql)
    assert "-- not a comment" in cleaned
    assert "/* also not */" in cleaned


def test_split_respects_semicolons_in_strings() -> None:
    sql = "SELECT 'a;b;c'; SELECT 2"
    stmts = split_statements(sql)
    assert stmts == ["SELECT 'a;b;c'", "SELECT 2"]


def test_read_only_passes_for_select() -> None:
    assert_read_only("SELECT 1")
    assert_read_only("WITH cte AS (SELECT 1 AS x) SELECT * FROM cte")
    assert_read_only("SET SHOWPLAN_XML ON; SELECT * FROM sys.tables")


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE users",
        "SELECT 1; DROP TABLE users",
        "/* */ DROP TABLE users",
        "-- harmless\nDROP TABLE users",
        "SELECT 1;\n-- x\nTRUNCATE TABLE foo",
        "INSERT INTO t VALUES (1)",
        "EXEC sp_who",
        "UPDATE t SET x = 1",
        "DELETE FROM t",
        "MERGE t USING s ON t.id = s.id WHEN MATCHED THEN DELETE;",
        "GRANT SELECT ON t TO public",
        "DBCC CHECKDB",
    ],
)
def test_read_only_rejects_writes(sql: str) -> None:
    with pytest.raises(WriteAttemptError):
        assert_read_only(sql)


def test_empty_batch_rejected() -> None:
    with pytest.raises(WriteAttemptError):
        assert_read_only("")
    with pytest.raises(WriteAttemptError):
        assert_read_only("  -- just a comment  \n  /* and another */  ")
