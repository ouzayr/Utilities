"""Introspection for stored procedures, functions, views, and triggers.

Kept separate from the table-focused queries because routines/views have their
own lifecycle and are useful for schema diff + dependency graph.
"""

from __future__ import annotations

from ..db.mssql import MssqlConnection

Q_ROUTINES = """
SELECT
    s.name AS schema_name,
    o.name AS name,
    o.type_desc AS type_desc,
    OBJECT_DEFINITION(o.object_id) AS definition,
    o.modify_date AS modify_date
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type_desc IN (
    'SQL_STORED_PROCEDURE',
    'SQL_SCALAR_FUNCTION',
    'SQL_INLINE_TABLE_VALUED_FUNCTION',
    'SQL_TABLE_VALUED_FUNCTION',
    'VIEW',
    'SQL_TRIGGER'
)
AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, o.type_desc, o.name;
"""


def get_routines(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_ROUTINES)
