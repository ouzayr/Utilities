"""Read-only introspection queries against sys.* and INFORMATION_SCHEMA.

All queries scope to the current database. They are parameterless and safe to
run against any SQL Server 2016+.
"""

from __future__ import annotations

from ..db.mssql import MssqlConnection

Q_TABLES = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    t.object_id AS object_id,
    CASE WHEN t.type = 'V' THEN 1 ELSE 0 END AS is_view,
    CAST(ep.value AS NVARCHAR(MAX)) AS description
FROM (
    SELECT name, object_id, schema_id, type FROM sys.tables
    UNION ALL
    SELECT name, object_id, schema_id, type FROM sys.views
) t
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN sys.extended_properties ep
  ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, t.name;
"""

Q_COLUMNS = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    c.name AS column_name,
    c.column_id AS ordinal,
    TYPE_NAME(c.user_type_id) AS data_type,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    c.is_identity,
    c.is_computed,
    OBJECT_DEFINITION(c.default_object_id) AS default_definition,
    CAST(ep.value AS NVARCHAR(MAX)) AS description
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN sys.extended_properties ep
  ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, t.name, c.column_id;
"""

Q_PRIMARY_KEYS = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    kc.name AS constraint_name,
    c.name AS column_name,
    ic.key_ordinal AS key_ordinal
FROM sys.key_constraints kc
JOIN sys.tables t ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'PK' AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, t.name, ic.key_ordinal;
"""

Q_UNIQUE_CONSTRAINTS = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    kc.name AS constraint_name,
    c.name AS column_name,
    ic.key_ordinal AS key_ordinal
FROM sys.key_constraints kc
JOIN sys.tables t ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'UQ' AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, t.name, kc.name, ic.key_ordinal;
"""

Q_FOREIGN_KEYS = """
SELECT
    fk.name AS constraint_name,
    ps.name AS parent_schema,
    pt.name AS parent_table,
    pc.name AS parent_column,
    rs.name AS ref_schema,
    rt.name AS ref_table,
    rc.name AS ref_column,
    fkc.constraint_column_id AS position,
    fk.delete_referential_action_desc AS on_delete,
    fk.update_referential_action_desc AS on_update,
    fk.is_disabled AS is_disabled,
    fk.is_not_trusted AS is_not_trusted
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
ORDER BY fk.name, fkc.constraint_column_id;
"""

Q_INDEXES = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    i.name AS index_name,
    i.index_id AS index_id,
    i.type_desc AS type_desc,
    i.is_unique AS is_unique,
    i.is_primary_key AS is_primary_key,
    i.is_unique_constraint AS is_unique_constraint,
    i.is_disabled AS is_disabled,
    i.has_filter AS has_filter,
    i.filter_definition AS filter_definition,
    c.name AS column_name,
    ic.key_ordinal AS key_ordinal,
    ic.is_included_column AS is_included_column,
    ic.is_descending_key AS is_descending_key,
    ius.user_seeks AS user_seeks,
    ius.user_scans AS user_scans,
    ius.user_lookups AS user_lookups,
    ius.user_updates AS user_updates,
    ius.last_user_seek AS last_user_seek,
    ius.last_user_scan AS last_user_scan
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
LEFT JOIN sys.dm_db_index_usage_stats ius
  ON ius.object_id = i.object_id AND ius.index_id = i.index_id AND ius.database_id = DB_ID()
WHERE i.type <> 0  -- skip heap "index"
  AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY s.name, t.name, i.index_id, ic.key_ordinal;
"""

Q_TABLE_SIZES = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    SUM(ps.row_count) AS row_count,
    SUM(ps.reserved_page_count) * 8 AS reserved_kb,
    SUM(ps.used_page_count) * 8 AS used_kb
FROM sys.dm_db_partition_stats ps
JOIN sys.tables t ON t.object_id = ps.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE ps.index_id IN (0, 1)  -- heap or clustered
  AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
GROUP BY s.name, t.name
ORDER BY s.name, t.name;
"""

Q_DEPENDENCIES = """
SELECT DISTINCT
    rs.name AS referencing_schema,
    ro.name AS referencing_name,
    ro.type_desc AS referencing_type,
    ISNULL(d.referenced_schema_name, OBJECT_SCHEMA_NAME(d.referenced_id)) AS referenced_schema,
    d.referenced_entity_name AS referenced_name
FROM sys.sql_expression_dependencies d
JOIN sys.objects ro ON ro.object_id = d.referencing_id
JOIN sys.schemas rs ON rs.schema_id = ro.schema_id
WHERE d.referenced_id IS NOT NULL
  AND ro.type_desc IN ('VIEW', 'SQL_STORED_PROCEDURE', 'SQL_SCALAR_FUNCTION',
                       'SQL_INLINE_TABLE_VALUED_FUNCTION', 'SQL_TABLE_VALUED_FUNCTION', 'SQL_TRIGGER');
"""


def get_tables(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_TABLES)


def get_columns(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_COLUMNS)


def get_primary_keys(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_PRIMARY_KEYS)


def get_unique_constraints(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_UNIQUE_CONSTRAINTS)


def get_foreign_keys(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_FOREIGN_KEYS)


def get_indexes(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_INDEXES)


def get_table_sizes(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_TABLE_SIZES)


def get_dependencies(conn: MssqlConnection) -> list[dict]:
    return conn.fetch_all(Q_DEPENDENCIES)
