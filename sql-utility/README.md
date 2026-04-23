# sqlutil

A local webapp for **auditing, documenting, and diffing SQL Server 2016+ databases**.
Built for senior devs and tech leads who need to quickly understand an unfamiliar
database, find performance / schema hygiene issues, produce docs, and spot drift
between environments.

> **Read-only by default.** The only writes the tool will ever perform are into a
> dedicated `sqlutil` schema in the target database, and only after you explicitly
> bootstrap that schema. Your user data is never modified.

## Features

- **Connection manager** — save multiple connections, encrypted at rest (Fernet). Supports **SQL logins, Windows (Trusted) auth, and named instances like `.\SQLEXPRESS`**.
- **Schema browser** — tables, views, columns, PK/FK/unique, indexes (with usage stats), row counts and size.
- **Interactive dependency graph** (React Flow) — click nodes to highlight FK neighbors; configurable depth/direction (in/out/both); optional routine edges.
- **ERD generator** — Mermaid `erDiagram` and DBML output from any subset of tables. Copy / download / render inline.
- **Health checks** — 20+ pluggable rules: indexing, schema hygiene, stats, and PII heuristics.
- **Metadata editor** — per-table and per-column descriptions, owner, domain, tags, sensitivity, glossary term, `llm_include` flag. Stored inside your DB in the `[sqlutil]` schema.
- **Export** — versioned JSON combining live schema + your metadata. Markdown and DBML also supported.
- **Schema diff** — compare two live connections. Detects added/removed/changed tables, columns, PKs, unique constraints, indexes, foreign keys, procs/views/functions/triggers. Generates additive migration SQL where safe.
- **Query playground** — read-only ad-hoc query runner; the input is parsed and every statement in the batch is validated (strips `-- ... ` and `/* ... */` comments, rejects write keywords).

## Architecture

```
apps/
  api/    FastAPI + pyodbc (ODBC Driver 18)
  web/    Vite + React + TypeScript + React Flow + Mermaid + Tailwind
scripts/
  seed-mssql.sql    small sample schema for manual testing
  dev-api.sh / dev-api.ps1   run the API locally without Docker
  dev-web.sh / dev-web.ps1   run the UI locally without Docker
docker-compose.yml  OPTIONAL Dockerised stack (DB + API + built web)
```

- Saved connections live in SQLite at `~/.sqlutil/app.db` (Windows:
  `%USERPROFILE%\.sqlutil\app.db`). Passwords are encrypted with Fernet using
  a key from `SQLUTIL_ENCRYPTION_KEY` (any string — it's hashed) or a random
  key written to `~/.sqlutil/secret.key` on first launch.
- The API is stateless; all schema / graph / diff work issues read-only queries
  against `sys.*`.

---

## Option A — Local SQL Server Express, no Docker (recommended for Windows)

This is the path to pick if you already have **SQL Server Express** installed on
your Windows box and don't want to run anything in Docker.

### 1. One-time SQL Server Express configuration

**A. Enable TCP/IP on the SQLEXPRESS instance.**

1. Open **SQL Server Configuration Manager**.
2. Expand *SQL Server Network Configuration* → *Protocols for SQLEXPRESS*.
3. Right-click **TCP/IP** → *Enable*.
4. Double-click **TCP/IP** → *IP Addresses* tab → scroll to **IPAll** at the
   bottom → clear *TCP Dynamic Ports* (make it blank) and set *TCP Port* to
   `1433` (or any free port — just remember it).
5. Restart the *SQL Server (SQLEXPRESS)* service from the *SQL Server Services*
   tab.

   ```powershell
   # Equivalent from an elevated PowerShell:
   Restart-Service 'MSSQL$SQLEXPRESS'
   ```

**B. Open the port in Windows Firewall (only if you're running the API on a
different machine or in WSL).**

```powershell
New-NetFirewallRule -DisplayName "SQLEXPRESS 1433" -Direction Inbound `
  -Protocol TCP -LocalPort 1433 -Action Allow
```

**C. Decide on auth mode.**

- **SQL auth** (simpler to use from WSL / Docker / macOS): in SSMS, right-click
  the server → *Properties* → *Security* → enable *SQL Server and Windows
  Authentication mode*. Restart the service. Then create a read-only login:

  ```sql
  CREATE LOGIN sqlutil_reader WITH PASSWORD = '<strong-password>';
  USE [YourDatabase];
  CREATE USER sqlutil_reader FOR LOGIN sqlutil_reader;
  GRANT VIEW DEFINITION, VIEW DATABASE STATE TO sqlutil_reader;
  EXEC sp_addrolemember 'db_datareader', 'sqlutil_reader';
  ```

- **Windows auth** (works only when the API runs on the same Windows box as
  SQLEXPRESS, and as a user that has access). Nothing to configure besides
  granting your Windows user `db_datareader` on the target DB.

**D. Verify from a terminal before touching the app:**

```powershell
# SQL auth
sqlcmd -S localhost,1433 -U sqlutil_reader -P '<password>' -Q "SELECT @@VERSION"

# Windows auth
sqlcmd -S localhost\SQLEXPRESS -E -Q "SELECT @@VERSION"
```

If `sqlcmd` works, the app will work.

### 2. Install the ODBC driver

Download **Microsoft ODBC Driver 18 for SQL Server**:
<https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server>

On Windows this is an MSI. On macOS / Linux / WSL, follow the
distro-specific install steps on the same page.

### 3. Install Python 3.11+ and Node 20+

- Python: <https://www.python.org/downloads/> (make sure *Add to PATH* is checked).
- Node: <https://nodejs.org/en/download>.

### 4. Clone the repo and start the two processes

**Windows PowerShell:**

```powershell
git clone https://github.com/ouzayr/Utilities.git
cd Utilities\sql-utility

# Backend
.\scripts\dev-api.ps1

# New terminal - frontend
.\scripts\dev-web.ps1
```

**macOS / Linux / WSL:**

```bash
git clone https://github.com/ouzayr/Utilities.git
cd Utilities/sql-utility

./scripts/dev-api.sh       # terminal 1
./scripts/dev-web.sh       # terminal 2
```

Both scripts are thin wrappers — you can run the commands yourself if you
prefer:

```bash
# Backend
cd apps/api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn sqlutil.main:app --reload --port 8000

# Frontend (another terminal)
cd apps/web
npm install
npm run dev                      # http://localhost:5173
```

Open <http://localhost:5173>.

### 5. Create your first connection

Click **New connection** → pick one of the three presets at the top of the form:

| Preset                                     | Host        | Instance     | Port  | Auth mode |
|--------------------------------------------|-------------|--------------|-------|-----------|
| *Local SQL Express (Windows auth)*         | `localhost` | `SQLEXPRESS` | blank | Windows   |
| *Local SQL Express (SQL auth)*             | `localhost` | `SQLEXPRESS` | blank | SQL       |
| *Default TCP 1433 (SQL auth)*              | `localhost` | blank        | 1433  | SQL       |

Fill in **Database** = the database name, **Username/Password** for SQL auth,
then **Save** and **Test** (the plug icon).

If anything fails, the error shown in the UI is the full ODBC / SQL Server
error — not a generic 500. See **Troubleshooting** below.

---

## Option B — Docker Compose (no local SQL Server needed)

Requires Docker Desktop (or any Docker engine). Spins up SQL Server 2022 in a
container, seeds a sample schema, builds the API image, and serves the built UI
from the API.

```bash
docker compose up --build
# UI + API at http://localhost:8000
# Sample DB at localhost:11433  (login: sa / SqlUtil!dev1234)
```

Seed the sample schema into the container:

```bash
docker cp scripts/seed-mssql.sql sqlutil-mssql:/tmp/seed.sql
docker exec sqlutil-mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'SqlUtil!dev1234' -No -i /tmp/seed.sql
```

Create a connection against host `mssql` (service name) port `1433` inside the
Docker network, or `localhost` port `11433` if connecting from your host.

---

## Recommended SQL Server setup (production use)

Use the script below to create a dedicated read-only login, optionally plus a
writer role scoped to the `[sqlutil]` metadata schema.

```sql
-- Read-only audit login
CREATE LOGIN sqlutil_reader WITH PASSWORD = '<strong>';
USE [YourDatabase];
CREATE USER  sqlutil_reader FOR LOGIN sqlutil_reader;
GRANT VIEW DEFINITION, VIEW DATABASE STATE TO sqlutil_reader;
EXEC sp_addrolemember 'db_datareader', 'sqlutil_reader';

-- Optional writer role, ONLY for the [sqlutil] metadata schema
CREATE ROLE sqlutil_writer;
GRANT ALTER, CONTROL ON SCHEMA::sqlutil TO sqlutil_writer;
EXEC sp_addrolemember 'sqlutil_writer', 'sqlutil_reader';
```

## Tests

```
cd apps/api
pytest
```

## Troubleshooting

| Symptom                                                                     | Likely cause / fix                                                                                                                             |
|-----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| `ODBC driver error: ... Data source name not found`                         | ODBC Driver 18 not installed. Install from the Microsoft page linked above.                                                                    |
| `SQL Server connection failed: Login timeout expired`                       | TCP/IP disabled on SQLEXPRESS, or SQL Browser service stopped, or the port isn't what the app thinks it is.                                    |
| `Login failed for user ...`                                                 | SQL auth not enabled (Mixed Mode), or wrong password, or the login has no user mapped in the target database.                                  |
| `Cannot open server ... requested by the login`                             | The `database` field is wrong for this login. The user must exist in that database.                                                            |
| Named instance `.\SQLEXPRESS` refuses to connect                            | Either enable TCP/IP + set a fixed port and put that port in the form, or start *SQL Server Browser* and leave Port blank so the app can find it via UDP 1434. |
| `certificate chain was issued by an authority that is not trusted`          | Leave *Trust server cert* on (default). For prod, install the server cert on the client machine instead.                                        |
| The first **Save** returns `a connection with this name already exists`     | You already have a connection with that name — pick another, or delete the old one.                                                            |
| Windows auth works in SSMS but not in the app                               | The API process is running as a different Windows user (common in services/containers). Run the API from PowerShell under your own user, or switch to SQL auth. |

## Roadmap

Planned, not yet shipped:

- EXPLAIN / showplan viewer in the UI (API already exposes `/query/explain`).
- Query Store slow-query dashboards.
- Schema + stats snapshots with drift trending.
- "Ask the schema" LLM endpoint that reuses saved metadata as context.
- PII masking in ad-hoc query previews.
