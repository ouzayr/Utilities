"""Normalized in-memory schema model, built from introspection rows."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from ..db.mssql import MssqlConnection
from . import queries


@dataclass
class Column:
    name: str
    ordinal: int
    data_type: str
    max_length: int
    precision: int
    scale: int
    is_nullable: bool
    is_identity: bool
    is_computed: bool
    default_definition: str | None
    description: str | None

    def type_string(self) -> str:
        t = self.data_type.lower()
        if t in ("varchar", "nvarchar", "char", "nchar", "binary", "varbinary"):
            if self.max_length == -1:
                return f"{self.data_type}(max)"
            length = self.max_length // 2 if t.startswith("n") else self.max_length
            return f"{self.data_type}({length})"
        if t in ("decimal", "numeric"):
            return f"{self.data_type}({self.precision},{self.scale})"
        return self.data_type


@dataclass
class PrimaryKey:
    name: str
    columns: list[str]


@dataclass
class UniqueConstraint:
    name: str
    columns: list[str]


@dataclass
class Index:
    name: str
    type_desc: str
    is_unique: bool
    is_primary_key: bool
    is_unique_constraint: bool
    is_disabled: bool
    has_filter: bool
    filter_definition: str | None
    key_columns: list[str]
    included_columns: list[str]
    user_seeks: int = 0
    user_scans: int = 0
    user_lookups: int = 0
    user_updates: int = 0


@dataclass
class ForeignKey:
    name: str
    columns: list[str]
    ref_schema: str
    ref_table: str
    ref_columns: list[str]
    on_delete: str
    on_update: str
    is_disabled: bool
    is_not_trusted: bool


@dataclass
class Table:
    schema: str
    name: str
    is_view: bool
    description: str | None
    columns: list[Column] = field(default_factory=list)
    primary_key: PrimaryKey | None = None
    unique_constraints: list[UniqueConstraint] = field(default_factory=list)
    indexes: list[Index] = field(default_factory=list)
    foreign_keys: list[ForeignKey] = field(default_factory=list)
    row_count: int = 0
    reserved_kb: int = 0
    used_kb: int = 0

    @property
    def fqname(self) -> str:
        return f"{self.schema}.{self.name}"


@dataclass
class Dependency:
    referencing_schema: str
    referencing_name: str
    referencing_type: str
    referenced_schema: str
    referenced_name: str


@dataclass
class Schema:
    tables: dict[str, Table]
    dependencies: list[Dependency]

    def table_list(self) -> list[Table]:
        return list(self.tables.values())

    def to_dict(self) -> dict[str, Any]:
        return {
            "tables": [
                {
                    "schema": t.schema,
                    "name": t.name,
                    "fqname": t.fqname,
                    "is_view": t.is_view,
                    "description": t.description,
                    "row_count": t.row_count,
                    "reserved_kb": t.reserved_kb,
                    "used_kb": t.used_kb,
                    "columns": [
                        {
                            "name": c.name,
                            "ordinal": c.ordinal,
                            "data_type": c.data_type,
                            "type_string": c.type_string(),
                            "max_length": c.max_length,
                            "precision": c.precision,
                            "scale": c.scale,
                            "is_nullable": c.is_nullable,
                            "is_identity": c.is_identity,
                            "is_computed": c.is_computed,
                            "default_definition": c.default_definition,
                            "description": c.description,
                        }
                        for c in t.columns
                    ],
                    "primary_key": (
                        {"name": t.primary_key.name, "columns": t.primary_key.columns}
                        if t.primary_key
                        else None
                    ),
                    "unique_constraints": [
                        {"name": u.name, "columns": u.columns} for u in t.unique_constraints
                    ],
                    "indexes": [
                        {
                            "name": i.name,
                            "type_desc": i.type_desc,
                            "is_unique": i.is_unique,
                            "is_primary_key": i.is_primary_key,
                            "is_unique_constraint": i.is_unique_constraint,
                            "is_disabled": i.is_disabled,
                            "has_filter": i.has_filter,
                            "filter_definition": i.filter_definition,
                            "key_columns": i.key_columns,
                            "included_columns": i.included_columns,
                            "user_seeks": i.user_seeks,
                            "user_scans": i.user_scans,
                            "user_lookups": i.user_lookups,
                            "user_updates": i.user_updates,
                        }
                        for i in t.indexes
                    ],
                    "foreign_keys": [
                        {
                            "name": fk.name,
                            "columns": fk.columns,
                            "ref_schema": fk.ref_schema,
                            "ref_table": fk.ref_table,
                            "ref_fqname": f"{fk.ref_schema}.{fk.ref_table}",
                            "ref_columns": fk.ref_columns,
                            "on_delete": fk.on_delete,
                            "on_update": fk.on_update,
                            "is_disabled": fk.is_disabled,
                            "is_not_trusted": fk.is_not_trusted,
                        }
                        for fk in t.foreign_keys
                    ],
                }
                for t in self.table_list()
            ],
            "dependencies": [
                {
                    "referencing_schema": d.referencing_schema,
                    "referencing_name": d.referencing_name,
                    "referencing_type": d.referencing_type,
                    "referenced_schema": d.referenced_schema,
                    "referenced_name": d.referenced_name,
                }
                for d in self.dependencies
            ],
        }


def build_schema(conn: MssqlConnection) -> Schema:
    tables_rows = queries.get_tables(conn)
    cols_rows = queries.get_columns(conn)
    pk_rows = queries.get_primary_keys(conn)
    uq_rows = queries.get_unique_constraints(conn)
    fk_rows = queries.get_foreign_keys(conn)
    idx_rows = queries.get_indexes(conn)
    size_rows = queries.get_table_sizes(conn)
    dep_rows = queries.get_dependencies(conn)

    tables: dict[str, Table] = {}
    for row in tables_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        tables[fq] = Table(
            schema=row["schema_name"],
            name=row["table_name"],
            is_view=bool(row["is_view"]),
            description=row["description"],
        )

    for row in cols_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        if fq not in tables:
            continue
        tables[fq].columns.append(
            Column(
                name=row["column_name"],
                ordinal=row["ordinal"],
                data_type=row["data_type"] or "unknown",
                max_length=row["max_length"],
                precision=row["precision"],
                scale=row["scale"],
                is_nullable=bool(row["is_nullable"]),
                is_identity=bool(row["is_identity"]),
                is_computed=bool(row["is_computed"]),
                default_definition=row["default_definition"],
                description=row["description"],
            )
        )

    pk_bucket: dict[str, dict[str, Any]] = {}
    for row in pk_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        bucket = pk_bucket.setdefault(fq, {"name": row["constraint_name"], "cols": []})
        bucket["cols"].append((row["key_ordinal"], row["column_name"]))
    for fq, bucket in pk_bucket.items():
        if fq in tables:
            cols = [c for _, c in sorted(bucket["cols"])]
            tables[fq].primary_key = PrimaryKey(name=bucket["name"], columns=cols)

    uq_bucket: dict[tuple[str, str], list[tuple[int, str]]] = defaultdict(list)
    for row in uq_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        uq_bucket[(fq, row["constraint_name"])].append((row["key_ordinal"], row["column_name"]))
    for (fq, name), rows in uq_bucket.items():
        if fq in tables:
            cols = [c for _, c in sorted(rows)]
            tables[fq].unique_constraints.append(UniqueConstraint(name=name, columns=cols))

    # indexes
    idx_bucket: dict[tuple[str, str], dict[str, Any]] = {}
    for row in idx_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        key = (fq, row["index_name"])
        bucket = idx_bucket.setdefault(
            key,
            {
                "type_desc": row["type_desc"],
                "is_unique": bool(row["is_unique"]),
                "is_primary_key": bool(row["is_primary_key"]),
                "is_unique_constraint": bool(row["is_unique_constraint"]),
                "is_disabled": bool(row["is_disabled"]),
                "has_filter": bool(row["has_filter"]),
                "filter_definition": row["filter_definition"],
                "key_cols": [],
                "included_cols": [],
                "user_seeks": row["user_seeks"] or 0,
                "user_scans": row["user_scans"] or 0,
                "user_lookups": row["user_lookups"] or 0,
                "user_updates": row["user_updates"] or 0,
            },
        )
        if row["is_included_column"]:
            bucket["included_cols"].append((row["key_ordinal"], row["column_name"]))
        else:
            bucket["key_cols"].append((row["key_ordinal"], row["column_name"]))

    for (fq, name), b in idx_bucket.items():
        if fq in tables:
            tables[fq].indexes.append(
                Index(
                    name=name,
                    type_desc=b["type_desc"],
                    is_unique=b["is_unique"],
                    is_primary_key=b["is_primary_key"],
                    is_unique_constraint=b["is_unique_constraint"],
                    is_disabled=b["is_disabled"],
                    has_filter=b["has_filter"],
                    filter_definition=b["filter_definition"],
                    key_columns=[c for _, c in sorted(b["key_cols"])],
                    included_columns=[c for _, c in sorted(b["included_cols"])],
                    user_seeks=b["user_seeks"],
                    user_scans=b["user_scans"],
                    user_lookups=b["user_lookups"],
                    user_updates=b["user_updates"],
                )
            )

    fk_bucket: dict[tuple[str, str], dict[str, Any]] = {}
    for row in fk_rows:
        parent_fq = f"{row['parent_schema']}.{row['parent_table']}"
        key = (parent_fq, row["constraint_name"])
        bucket = fk_bucket.setdefault(
            key,
            {
                "ref_schema": row["ref_schema"],
                "ref_table": row["ref_table"],
                "on_delete": row["on_delete"],
                "on_update": row["on_update"],
                "is_disabled": bool(row["is_disabled"]),
                "is_not_trusted": bool(row["is_not_trusted"]),
                "cols": [],
                "ref_cols": [],
            },
        )
        bucket["cols"].append((row["position"], row["parent_column"]))
        bucket["ref_cols"].append((row["position"], row["ref_column"]))
    for (parent_fq, name), b in fk_bucket.items():
        if parent_fq in tables:
            tables[parent_fq].foreign_keys.append(
                ForeignKey(
                    name=name,
                    columns=[c for _, c in sorted(b["cols"])],
                    ref_schema=b["ref_schema"],
                    ref_table=b["ref_table"],
                    ref_columns=[c for _, c in sorted(b["ref_cols"])],
                    on_delete=b["on_delete"],
                    on_update=b["on_update"],
                    is_disabled=b["is_disabled"],
                    is_not_trusted=b["is_not_trusted"],
                )
            )

    for row in size_rows:
        fq = f"{row['schema_name']}.{row['table_name']}"
        if fq in tables:
            tables[fq].row_count = int(row["row_count"] or 0)
            tables[fq].reserved_kb = int(row["reserved_kb"] or 0)
            tables[fq].used_kb = int(row["used_kb"] or 0)

    deps = [
        Dependency(
            referencing_schema=r["referencing_schema"],
            referencing_name=r["referencing_name"],
            referencing_type=r["referencing_type"],
            referenced_schema=r["referenced_schema"],
            referenced_name=r["referenced_name"],
        )
        for r in dep_rows
        if r["referenced_schema"] and r["referenced_name"]
    ]

    return Schema(tables=tables, dependencies=deps)
