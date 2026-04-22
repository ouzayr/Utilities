# sqlutil

A local webapp for **auditing, documenting, and diffing SQL Server 2016+ databases**.
Built for senior devs and tech leads who need to quickly understand an unfamiliar
database, find performance / schema hygiene issues, produce docs, and spot drift
between environments.

> **Read-only by default.** The only writes the tool will ever perform are into a
> dedicated `sqlutil` schema in the target database, and only after you explicitly
> bootstrap that schema. Your user data is never modified.

## Features

- **Connection manager** — save multiple connections, encrypted at rest (Fernet). Test + check permissions on demand.
- **Schema browser** — tables, views, columns, PK/FK/unique, indexes (with usage stats), row counts and size.
- **Interactive dependency graph** (React Flow) — click nodes to highlight FK neighbors; configurable depth/direction (in/out/both); optional routine edges.
- **ERD generator** — Mermaid `erDiagram` and DBML output from any subset of tables. Copy / download / render inline.
- **Health checks** — 20+ pluggable rules across:
    - Indexing: FK missing index, duplicate / overlapping, unused, heap table on large rows, disabled.
    - Schema: missing PK, nullable FK, untrusted FK, `nvarchar(max)` abuse, `float` for money, legacy `datetime`, columns that look like FKs but aren't, inconsistent PK column naming.
    - Stats / usage: large tables with no non-clustered indexes.
    - PII heuristics: email / phone / SSN / first/last name / DOB / address / CC / passport / IP — flagged with sensitivity suggestions.
- **Metadata editor** — per-table and per-column descriptions, owner, domain, tags, sensitivity, glossary term, `llm_include` flag. Stored inside your DB (`[sqlutil].table_meta`, `[sqlutil].column_meta`).
- **Export** — versioned JSON combining live schema + your metadata (drop into git or feed to an LLM). Markdown and DBML also supported.
- **Schema diff** — compare two live connections (or two databases on the same connection). Detects added/removed/changed tables, columns, primary keys, unique constraints, indexes, foreign keys, and stored procedures / views / functions / triggers. Generates additive migration SQL where safe.
- **Query playground** — read-only ad-hoc query runner with explicit rejection of write statements.

## Architecture

```
apps/
  api/    FastAPI + pyodbc + SQLAlchemy
  web/    Vite + React + TypeScript + React Flow + Mermaid + Tailwind
scripts/
  seed-mssql.sql    small sample schema for manual testing
docker-compose.yml  local Dockerised dev stack
```

- Connections are saved in a local SQLite file at `~/.sqlutil/app.db`. Passwords
  are encrypted with Fernet using a key read from `SQLUTIL_ENCRYPTION_KEY` (any
  string — it's hashed to a valid key) or, if unset, a random key generated on
  first launch at `~/.sqlutil/secret.key`.
- The API is mostly stateless; all live schema/graph/diff work is done by issuing
  read-only queries against `sys.*` views.
- The React app is a single-page app served by Vite during dev and by the
  FastAPI process in Docker (see `apps/api/Dockerfile`).

## Quick start (local dev)

Requires Python 3.11+, Node 20+, a SQL Server 2016+ instance, and the
**ODBC Driver 18 for SQL Server** installed on your machine.

```bash
# 1. spin up a throwaway SQL Server and seed it (optional — skip if you have one)
docker run -d --name sqlutil-mssql -p 1433:1433 \
  -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=SqlUtil!dev1234" \
  mcr.microsoft.com/mssql/server:2022-latest
docker cp scripts/seed-mssql.sql sqlutil-mssql:/tmp/seed.sql
docker exec sqlutil-mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'SqlUtil!dev1234' -No -i /tmp/seed.sql

# 2. backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn sqlutil.main:app --reload --port 8000

# 3. frontend (separate terminal)
cd apps/web
npm install
npm run dev  # http://localhost:5173
```

Open http://localhost:5173, create a connection against `localhost:1433` / `SqlutilSample` / `sa` / `SqlUtil!dev1234`, then click through **Schema**, **Graph**, **ERD**, **Health checks**, **Metadata**, **Schema diff**, **Query**.

## Docker Compose

```bash
docker compose up --build
# UI at http://localhost:8000
# sample mssql at localhost:11433
```

## Recommended SQL Server setup

The tool works with any login, but you should create a dedicated read-only user
and grant it a small write role only if you want metadata persistence:

```sql
-- Read-only audit login (recommended).
CREATE LOGIN sqlutil_reader WITH PASSWORD = '<strong>';
CREATE USER  sqlutil_reader FOR LOGIN sqlutil_reader;
GRANT VIEW DEFINITION, VIEW DATABASE STATE TO sqlutil_reader;
EXEC sp_addrolemember 'db_datareader', 'sqlutil_reader';

-- Optional writer role, scoped to the [sqlutil] schema only.
CREATE ROLE sqlutil_writer;
GRANT ALTER, CONTROL ON SCHEMA::sqlutil TO sqlutil_writer;
EXEC sp_addrolemember 'sqlutil_writer', 'sqlutil_reader';
```

## Tests

```
cd apps/api
pytest
```

## Roadmap

- [ ] `EXPLAIN`/showplan viewer UI (the API endpoint is already live at `/api/connections/{id}/query/explain`).
- [ ] Query Store integration for slow-query dashboards.
- [ ] Snapshots + size/row-count trend charts.
- [ ] `Ask the schema` LLM endpoint (uses the JSON export as context).
- [ ] PII masking in query-playground preview rows.
