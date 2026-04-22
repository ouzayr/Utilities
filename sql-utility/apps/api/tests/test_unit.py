"""Pure-python unit tests that don't require a live SQL Server."""

from sqlutil.checks.engine import run_all_checks
from sqlutil.diff import diff_schemas
from sqlutil.erd import to_dbml, to_mermaid
from sqlutil.graph.resolver import build_graph, expand_selection
from sqlutil.introspect.schema_model import (
    Column,
    ForeignKey,
    Index,
    PrimaryKey,
    Schema,
    Table,
)
from sqlutil.metadata.exporter import to_json, to_markdown


def _sample_schema() -> Schema:
    customer = Table(
        schema="sales",
        name="customer",
        is_view=False,
        description=None,
        columns=[
            Column(name="customer_id", ordinal=1, data_type="int", max_length=4, precision=10, scale=0, is_nullable=False, is_identity=True, is_computed=False, default_definition=None, description=None),
            Column(name="email", ordinal=2, data_type="nvarchar", max_length=512, precision=0, scale=0, is_nullable=False, is_identity=False, is_computed=False, default_definition=None, description=None),
            Column(name="first_name", ordinal=3, data_type="nvarchar", max_length=200, precision=0, scale=0, is_nullable=False, is_identity=False, is_computed=False, default_definition=None, description=None),
        ],
        primary_key=PrimaryKey(name="PK_customer", columns=["customer_id"]),
        unique_constraints=[],
        indexes=[Index(name="PK_customer", type_desc="CLUSTERED", is_unique=True, is_primary_key=True, is_unique_constraint=False, is_disabled=False, has_filter=False, filter_definition=None, key_columns=["customer_id"], included_columns=[], user_seeks=100, user_scans=0, user_lookups=0, user_updates=10)],
        foreign_keys=[],
        row_count=1000,
        reserved_kb=128,
        used_kb=120,
    )
    order = Table(
        schema="sales",
        name="order",
        is_view=False,
        description=None,
        columns=[
            Column(name="order_id", ordinal=1, data_type="int", max_length=4, precision=10, scale=0, is_nullable=False, is_identity=True, is_computed=False, default_definition=None, description=None),
            Column(name="customer_id", ordinal=2, data_type="int", max_length=4, precision=10, scale=0, is_nullable=False, is_identity=False, is_computed=False, default_definition=None, description=None),
            Column(name="price", ordinal=3, data_type="float", max_length=8, precision=53, scale=0, is_nullable=False, is_identity=False, is_computed=False, default_definition=None, description=None),
        ],
        primary_key=PrimaryKey(name="PK_order", columns=["order_id"]),
        unique_constraints=[],
        indexes=[Index(name="PK_order", type_desc="CLUSTERED", is_unique=True, is_primary_key=True, is_unique_constraint=False, is_disabled=False, has_filter=False, filter_definition=None, key_columns=["order_id"], included_columns=[], user_seeks=0, user_scans=0, user_lookups=0, user_updates=0)],
        foreign_keys=[ForeignKey(name="FK_order_customer", columns=["customer_id"], ref_schema="sales", ref_table="customer", ref_columns=["customer_id"], on_delete="NO_ACTION", on_update="NO_ACTION", is_disabled=False, is_not_trusted=False)],
        row_count=5000,
        reserved_kb=1024,
        used_kb=900,
    )
    return Schema(tables={"sales.customer": customer, "sales.order": order}, dependencies=[])


def test_run_all_checks_fires_expected_rules() -> None:
    schema = _sample_schema()
    results = run_all_checks(schema)
    rule_ids = {r.rule_id for r in results}
    # FK without an index on sales.order.customer_id
    assert "idx.fk_missing_index" in rule_ids
    # float used for money-like column
    assert "schema.float_money" in rule_ids
    # heuristic PII columns: email, first_name
    assert "pii.likely_column" in rule_ids


def test_mermaid_and_dbml_include_selected_tables_only() -> None:
    schema = _sample_schema()
    mermaid = to_mermaid(schema, selected_fqnames=["sales.customer", "sales.order"])
    assert "erDiagram" in mermaid
    assert "sales_customer" in mermaid.replace(".", "_") or "customer" in mermaid
    dbml = to_dbml(schema)
    assert "customer" in dbml and "order" in dbml
    assert "Ref:" in dbml  # FK rendered


def test_graph_and_expand_selection() -> None:
    schema = _sample_schema()
    g = build_graph(schema)
    ids = {n["id"] for n in g["nodes"]}
    assert ids == {"sales.customer", "sales.order"}
    assert len(g["edges"]) == 1
    expanded = expand_selection(g, ["sales.customer"], depth=1, direction="in")
    assert "sales.order" in expanded["highlighted_nodes"]


def test_diff_detects_added_and_removed_tables() -> None:
    source = _sample_schema()
    # target missing one table, and one column differs
    target_tables = {k: v for k, v in source.tables.items() if k == "sales.customer"}
    target_tables["sales.customer"] = Table(
        schema="sales", name="customer", is_view=False, description=None,
        columns=[c for c in source.tables["sales.customer"].columns if c.name != "first_name"],
        primary_key=source.tables["sales.customer"].primary_key,
        unique_constraints=[], indexes=source.tables["sales.customer"].indexes,
        foreign_keys=[], row_count=0, reserved_kb=0, used_kb=0,
    )
    target = Schema(tables=target_tables, dependencies=[])

    result = diff_schemas(source, target, source_name="src", target_name="tgt")
    ops = {(e.kind, e.op, e.object) for e in result.entries}
    assert ("table", "added", "sales.order") in ops
    assert ("column", "added", "sales.customer.first_name") in ops


def test_exporter_json_and_markdown() -> None:
    schema = _sample_schema()
    doc = to_json(schema, [], [], database_name="sample")
    assert doc["$schema_version"]
    assert any(t["fqname"] == "sales.customer" for t in doc["tables"])
    md = to_markdown(doc)
    assert "# sample" in md
    assert "sales.customer" in md
