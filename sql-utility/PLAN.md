# SQL Utility — Plan

**Target engine:** SQL Server (2019/2022)
**Deployment:** Local-only, Docker Compose
**Stack:** FastAPI (Python 3.12) + React 18 + TypeScript + Vite + Tailwind + shadcn/ui + React Flow
**Metadata storage:** dedicated schema `sqlutil` inside the target DB

---

## 1. Architecture

```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  apps/web   (Vite + React)   │ ←→ │  apps/api  (FastAPI)         │
│  - Dashboard                 │    │  - /connections              │
│  - Schema browser            │    │  - /introspect               │
│  - Health checks             │    │  - /health-checks/*          │
│  - Graph (React Flow)        │    │  - /erd (mermaid + dbml)     │
│  - ERD viewer                │    │  - /metadata (CRUD + export) │
│  - Metadata editor           │    │  - /query/explain            │
└──────────────────────────────┘    │  - /security/audit           │
                                    └──────────────┬───────────────┘
                                                   │ pyodbc / aioodbc
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │  User SQL Server             │
                                    │  + schema `sqlutil` for      │
                                    │    stored metadata           │
                                    └──────────────────────────────┘
```

All three services run in one `docker-compose.yml`:
- `api` — FastAPI with uvicorn
- `web` — built static assets served by the api (or nginx in prod)
- `mssql` — **optional** dev container (SQL Server 2022) for local testing

The tool never writes to user data. It only writes to the `sqlutil` schema (metadata) — and only after explicit opt-in per connection.

---

## 2. Connection model

- Saved connections stored **locally** (SQLite at `~/.sqlutil/app.db`) — not in the target DB, so you can manage multiple servers.
- On connect, the app checks the login's effective permissions and warns if it looks like `sysadmin` / `db_owner`. Recommends a read-only role + a narrow `sqlutil_writer` role scoped to the `sqlutil` schema.
- Generates a setup SQL script you can review and run once per DB:

```sql
CREATE SCHEMA sqlutil;
CREATE ROLE sqlutil_writer AUTHORIZATION dbo;
GRANT CREATE TABLE, ALTER, SELECT, INSERT, UPDATE, DELETE ON SCHEMA::sqlutil TO sqlutil_writer;
-- tool bootstraps its own tables inside sqlutil on first use
```

---

## 3. Feature set (v1)

### 3.1 Schema introspection
Sourced from `sys.*` and `INFORMATION_SCHEMA.*`:
- tables, views, columns, computed cols, identity, defaults, check constraints
- PK / FK / unique constraints
- indexes (clustered, NC, filtered, included cols, is_unique, is_disabled)
- row counts + data/index size (from `sys.dm_db_partition_stats`)
- row counts sampled for big tables
- stats last-updated time (`sys.dm_db_stats_properties`)

### 3.2 Health checks
Each check returns: `{severity, table, column?, description, remediation_sql}`.

**Indexing**
- Foreign keys missing a supporting index (common perf footgun on MSSQL)
- Unused indexes (`sys.dm_db_index_usage_stats` — zero seeks/scans since last restart)
- Duplicate / overlapping indexes (same leading key columns)
- Missing index suggestions from `sys.dm_db_missing_index_*` DMVs (ranked by impact)
- Heap tables (no clustered index) with > N rows
- Disabled indexes
- Indexes with high fragmentation (`sys.dm_db_index_physical_stats` SAMPLED)

**Schema hygiene**
- Tables without a primary key
- Nullable FK columns (often a bug)
- `NVARCHAR(MAX)` / `VARCHAR(MAX)` used where a bounded length is probably enough
- `datetime` instead of `datetime2`
- `float`/`real` used for money (should be `decimal`)
- Columns named `*_id` that are not FKs
- Tables with 0 rows but heavy index count (possibly dead)
- Inconsistent naming (PascalCase vs snake_case mix)

**Statistics & maintenance**
- Stats not updated in > 30 days on large tables
- Auto-update stats disabled
- Log file growth events, autogrowth set to percentage (anti-pattern)

**Security**
- Columns likely to hold PII (name/email/phone/ssn/dob heuristics) without column-level encryption or masking
- Logins with `sysadmin` used by apps
- `xp_cmdshell` enabled
- Contained-db / orphaned users

Each check has an impact score; dashboard shows top issues and trend over time (snapshots).

### 3.3 ERD generator
- Select any subset of tables (or "all in schema X")
- Output formats:
  - **Mermaid `erDiagram`** (for markdown docs)
  - **DBML** (dbdocs.io-compatible)
  - **SVG** (rendered client-side)
- Respects FK cardinality, shows PK/FK badges, column types, and your custom metadata descriptions

### 3.4 Interactive dependency graph
- React Flow canvas with one node per table, edges = FK relationships
- Layout: dagre for hierarchical, or force-directed toggle
- Click / multi-select tables → the graph highlights:
  - direct FK neighbors (depth 1)
  - transitive dependents / dependencies (configurable depth slider)
  - tables referenced via views / procs (from `sys.sql_expression_dependencies`)
- Nodes colored by size / health-check severity
- Mini-map, search, "focus mode" (hide everything else)

### 3.5 Metadata editor
Stored in `sqlutil.table_meta` and `sqlutil.column_meta`:
- description (markdown)
- owner / team
- tags (e.g. `pii`, `deprecated`, `hot`)
- sample values (optional)
- glossary-term links
- source-of-truth link (Confluence/Jira/ADR)
- LLM-training toggle (include/exclude from export)

Export formats: **JSON** (primary, schema-versioned), **Markdown docs**, **DBML**, **OpenAPI-style components**. JSON shape is stable and documented so it can feed doc generators or LLM fine-tuning.

### 3.6 Bonus — additional high-value features
- **Query playground** with `SET SHOWPLAN_XML` visualizer and plan-node drill-down
- **Plan diffing** between two runs / two environments
- **Slow query dashboard** from Query Store (`sys.query_store_*`)
- **Schema diff** between two connections (prod vs staging) → generates migration SQL
- **Snapshots**: weekly capture of schema + stats + metadata, diff over time
- **Sensitive-column masking** on any preview / sample-row view
- **"Ask the schema" endpoint** that packages metadata + schema into a prompt for an LLM of your choice (BYO key)
- **CLI** (`sqlutil export`, `sqlutil check`) so it can run in CI against a migration-applied DB

---

## 4. Project layout

```
sql-utility/
├── apps/
│   ├── api/                 FastAPI service
│   │   ├── sqlutil/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── db/          connection pool, mssql dialect
│   │   │   ├── introspect/  sys.* queries
│   │   │   ├── checks/      one file per rule, registered into a registry
│   │   │   ├── erd/         mermaid + dbml generators
│   │   │   ├── graph/       dependency resolver
│   │   │   ├── metadata/    CRUD + exporters
│   │   │   └── routes/
│   │   ├── tests/
│   │   └── pyproject.toml
│   └── web/                 Vite + React + TS
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── graph/          React Flow
│       │   │   ├── erd/            Mermaid renderer
│       │   │   ├── checks/
│       │   │   └── metadata/
│       │   └── lib/api.ts
│       └── package.json
├── docker-compose.yml        api + web + optional mssql
├── docker-compose.dev.yml    with seeded sample DB
├── scripts/
│   └── seed-mssql.sql        AdventureWorks-lite for testing
└── README.md
```

---

## 5. Milestones

1. Scaffold monorepo, docker-compose, seeded SQL Server 2022 for dev.
2. Connection flow + introspection + schema browser.
3. Metadata schema bootstrap + editor + JSON export.
4. React Flow dependency graph with selection highlighting.
5. ERD generator (Mermaid + DBML).
6. Health-check engine + top 12 rules listed in §3.2.
7. Bonus: EXPLAIN viewer, PII heuristics.
8. Polish, README with screenshots, PR.

I will prioritize (1)–(6) for v1 and land (7) as follow-up commits if time allows in this session.
