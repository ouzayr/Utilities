import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export type Connection = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
};

export type GraphNode = {
  id: string;
  schema: string;
  name: string;
  kind: "table" | "view";
  row_count: number;
  reserved_kb: number;
  column_count: number;
  has_primary_key: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "fk" | "uses";
  name: string;
  columns: string[];
  ref_columns: string[];
};

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type SchemaTable = {
  schema: string;
  name: string;
  fqname: string;
  is_view: boolean;
  description: string | null;
  row_count: number;
  reserved_kb: number;
  used_kb: number;
  columns: SchemaColumn[];
  primary_key: { name: string; columns: string[] } | null;
  unique_constraints: { name: string; columns: string[] }[];
  indexes: SchemaIndex[];
  foreign_keys: SchemaForeignKey[];
};

export type SchemaColumn = {
  name: string;
  ordinal: number;
  data_type: string;
  type_string: string;
  is_nullable: boolean;
  is_identity: boolean;
  is_computed: boolean;
  default_definition: string | null;
  description: string | null;
};

export type SchemaIndex = {
  name: string;
  type_desc: string;
  is_unique: boolean;
  is_primary_key: boolean;
  is_disabled: boolean;
  key_columns: string[];
  included_columns: string[];
  user_seeks: number;
  user_scans: number;
  user_lookups: number;
  user_updates: number;
};

export type SchemaForeignKey = {
  name: string;
  columns: string[];
  ref_schema: string;
  ref_table: string;
  ref_fqname: string;
  ref_columns: string[];
  on_delete: string;
  on_update: string;
  is_disabled: boolean;
  is_not_trusted: boolean;
};

export type Schema = {
  tables: SchemaTable[];
  dependencies: {
    referencing_schema: string;
    referencing_name: string;
    referencing_type: string;
    referenced_schema: string;
    referenced_name: string;
  }[];
};

export type CheckResult = {
  rule_id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  table: string | null;
  column: string | null;
  description: string;
  remediation_sql: string | null;
  tags: string[];
};
