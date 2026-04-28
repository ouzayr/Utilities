# code-cartographer

A **local, read-only** static-analysis utility that maps your **Angular (UI)** and
**.NET (API)** repositories into one interactive graph so you can answer questions
like:

- *"Which controller does this Angular component eventually hit?"*
- *"If I rename `OrderService.Cancel`, what UI breaks?"*
- *"Which endpoints has nobody in the UI ever called?"*
- *"Where are my dead components, unused SCSS classes, layering violations?"*

> **Read-only by design.** code-cartographer never writes to your source repos,
> never executes your code, never calls out to the internet at runtime, and never
> reads your git history beyond the current working tree. See
> [Privacy & constraints](#privacy--constraints).

---

## Table of contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Privacy & constraints](#privacy--constraints)
3. [Prerequisites](#prerequisites)
4. [Option A — Run everything in Docker (recommended)](#option-a--run-everything-in-docker-recommended)
5. [Option B — Run locally without Docker](#option-b--run-locally-without-docker)
6. [Adding your own repositories](#adding-your-own-repositories)
7. [Using the UI](#using-the-ui)
8. [Configuration reference](#configuration-reference)
9. [Troubleshooting](#troubleshooting)
10. [Roadmap](#roadmap)

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                            code-cartographer                          │
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ scanner-angular │    │ scanner-dotnet  │    │   sample-ui     │  │
│  │  (Node/ts-morph)│    │   (C#/Roslyn)   │    │   sample-api    │  │
│  └────────┬────────┘    └────────┬────────┘    │  (synthetic)    │  │
│           │  graph.json           │  graph.json └─────────────────┘  │
│           └────────────┬──────────┘                                   │
│                        ▼                                              │
│                ┌──────────────┐         ┌─────────────────┐          │
│                │   api        │ ◄─────► │   PostgreSQL    │          │
│                │  (.NET 8)    │         │   (graph store) │          │
│                └──────┬───────┘         └─────────────────┘          │
│                       │ REST                                          │
│                       ▼                                               │
│                ┌──────────────┐                                       │
│                │   web        │                                       │
│                │ (Angular 17  │                                       │
│                │ + Cytoscape) │                                       │
│                └──────────────┘                                       │
└──────────────────────────────────────────────────────────────────────┘
```

Each scanner emits a normalised `graph.json` (nodes + edges + metrics). The API
ingests, stores, deduplicates and **cross-links** UI HTTP calls to .NET routes,
then serves the unified graph to the web UI.

For the design rationale and full data model, see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Privacy & constraints

| Constraint | What it means in practice |
|---|---|
| **Read-only** | The tool never writes to your source folders. It only reads files. |
| **Static-only** | It never executes your code; no `dotnet run`, no `npm start` against your repos. |
| **Offline at runtime** | After install, the running app makes **zero outbound network requests**. No telemetry. No LLM calls. No package fetches. |
| **No git history** | Only your current working tree is scanned. We never `git log` or check out other refs. |
| **No SaaS integrations** | No Slack/Teams/Jira webhooks. CI integration is a self-hosted CLI only. |
| **Single user, localhost** | No multi-tenant auth. Bind to `127.0.0.1` (default) and you're done. |

---

## Prerequisites

### For Docker mode (Option A) — easy path
- **Docker Desktop 4.x** (or Docker Engine 24+ with Compose v2 on Linux)
- 8 GB free RAM, 5 GB free disk

### For local mode (Option B) — needed for development on the tool itself
- **Node.js 20+** and **npm 10+** (for `scanner-angular` and `web`)
- **.NET 8 SDK** (for `scanner-dotnet` and `api`)
- **PostgreSQL 16** (or Docker for just the DB)
- **Git** (only used to identify the working tree, never to read history)

---

## Option A — Run everything in Docker (recommended)

This is the fastest path. One command, one stack.

### 1. Clone and configure

```bash
git clone https://github.com/ouzayr/Utilities.git
cd Utilities/code-cartographer
cp .env.example .env
# Open .env and edit CC_REPO_ROOTS to point at the folders you want scanned.
# By default it scans the bundled samples/ directory.
```

### 2. Build and start the stack

```bash
docker compose build
docker compose up -d
```

This starts four services:

| Service | Port | Purpose |
|---|---|---|
| `cc-db` | `15432` | PostgreSQL 16 (graph store) |
| `cc-api` | `8080` | .NET 8 orchestrator + REST API |
| `cc-web` | `4200` | Angular 17 web UI |
| `cc-scanner-angular` | — | One-shot Node container (Angular scanner) |
| `cc-scanner-dotnet` | — | One-shot .NET SDK container (Roslyn scanner) |

### 3. Open the UI

Browse to **<http://localhost:4200>**.

### 4. Run the bundled sample scan

```bash
# Create an empty scan and capture its id, then run both scanners against it.
SCAN_ID=$(curl -s -X POST http://localhost:8080/api/scans -H 'Content-Type: application/json' -d '{"label":"samples"}' | jq -r .scanId)
docker compose --profile scan run --rm scanner-angular --root /work/sample-ui --project sample-ui --api-base http://api:8080 --scan-id "$SCAN_ID"
docker compose --profile scan run --rm scanner-dotnet --root /work/sample-api --project sample-api --api-base http://api:8080 --scan-id "$SCAN_ID" --finalize
```

Refresh the web UI — the scan now appears on the **Dashboard** with full UI ↔
API cross-links visible on the **Graph** and **Endpoints** views.

### 5. Mount your own code

`docker-compose.yml` maps `./samples` into the scanner containers read-only at
`/work/...`. To scan your own code, override the volumes and `command`:

```bash
docker compose --profile scan run --rm \
  -v /absolute/path/to/your/angular-app:/work/myui:ro \
  scanner-angular --root /work/myui --project myui --api-base http://api:8080 --scan-id "$SCAN_ID"

docker compose --profile scan run --rm \
  -v /absolute/path/to/your/dotnet-solution:/work/myapi:ro \
  scanner-dotnet --root /work/myapi --project myapi --api-base http://api:8080 --scan-id "$SCAN_ID" --finalize
```

You can also register repositories permanently via the **Repos** page in the UI;
the API persists them to Postgres so they survive restarts.

### 5. Stop & clean up

```bash
docker compose down              # stop, keep data
docker compose down --volumes    # stop and wipe the Postgres volume
```

---

## Option B — Run locally without Docker

Useful for hacking on code-cartographer itself.

### 1. Start Postgres

Either use a local install of Postgres 16, or just run the DB in Docker:

```bash
docker run --rm -d \
  --name cc-db \
  -e POSTGRES_USER=cc \
  -e POSTGRES_PASSWORD=cc \
  -e POSTGRES_DB=codecartographer \
  -p 15432:5432 \
  postgres:16
```

### 2. Run the API

```bash
cd apps/api
export CC_DB_CONNECTION="Host=localhost;Port=15432;Database=codecartographer;Username=cc;Password=cc"
dotnet restore
dotnet run                       # listens on http://localhost:8080, auto-creates schema
```

### 3. Create a scan and run the Angular scanner

```bash
SCAN_ID=$(curl -s -X POST http://localhost:8080/api/scans -H 'Content-Type: application/json' -d '{"label":"local"}' | jq -r .scanId)

cd apps/scanner-angular
npm install
npm run build
node dist/index.js \
  --root ../../samples/sample-ui --project sample-ui \
  --api-base http://localhost:8080 --scan-id "$SCAN_ID"
```

### 4. Run the .NET scanner

```bash
cd apps/scanner-dotnet
dotnet run -- \
  --root ../../samples/sample-api --project sample-api \
  --api-base http://localhost:8080 --scan-id "$SCAN_ID" --finalize
```

### 5. Run the web UI

```bash
cd apps/web
npm install
npm start                         # http://localhost:4200
```

---

## Adding your own repositories

You don't have to hand-edit `docker-compose.yml` for every repo. The web UI
exposes a **Repositories** page where you can:

1. Click **"Add local folder"** → pick a path that's already mounted into the
   scanner container (or that exists on the host in non-Docker mode).
2. Tag each repo as `ui`, `api`, or `both`.
3. Pick which projects within a monorepo to include / exclude (glob patterns).
4. Click **Scan**.

The API persists the repo list in Postgres so they stick across restarts.

> **Cloning from GitHub / Azure DevOps** is supported (provide a personal access
> token in the UI), but the clone happens **on first use only** and then the
> tool falls back to read-only static analysis on the clone. The token is stored
> encrypted-at-rest using a key derived from `CC_ENCRYPTION_KEY` (see
> [Configuration reference](#configuration-reference)).

---

## Using the UI

| View | What you can do |
|---|---|
| **Overview** | Project counts, total nodes/edges, lint summary, last scan time. |
| **Graph** | The full UI ↔ API graph. Filter by side (UI/API/both), kind (component/service/controller/etc.), or project. Click any node to highlight its 1-hop, 2-hop, or full transitive neighbourhood. Save the current view as a named **bookmark**. |
| **Flow trace** | Pick a starting node (e.g. `OrderListComponent`) and a direction (downstream / upstream / both). The graph rerenders as a **linear left-to-right flow** showing every hop from UI through services, HTTP calls, controllers, services, repositories, EF entities. |
| **Endpoints** | Every API endpoint with its HTTP verb, route, auth attributes, request/response DTOs, and the list of UI components that call it. Orphan endpoints (no UI caller) are flagged. |
| **Lint** | Findings grouped by severity: dead code, layering violations, SCSS/CSS hygiene, security smells, perf smells. Each finding links to the file:line. |
| **Diffs** | Compare the latest scan against any earlier scan ("snapshot diff", not git diff). See added / removed / changed nodes and edges. |
| **Export** | PNG / SVG / PDF of the current view, plus a Markdown architecture report. |

---

## Configuration reference

All configuration is via environment variables. `cp .env.example .env` and edit.

| Variable | Default | Meaning |
|---|---|---|
| `CC_DB_CONNECTION` | `Host=cc-db;Port=5432;Database=codecartographer;Username=cc;Password=cc` | Postgres connection string used by the API. |
| `CC_REPO_ROOTS` | `/repos/samples` | Comma-separated list of paths the scanner walks. |
| `CC_INCLUDE_GLOBS` | `**/*.cs,**/*.csproj,**/*.sln,**/*.ts,**/*.html,**/*.scss,**/*.css,**/angular.json,**/package.json` | Files the scanners look at. |
| `CC_EXCLUDE_GLOBS` | `**/node_modules/**,**/bin/**,**/obj/**,**/dist/**,**/.git/**` | Files the scanners ignore. |
| `CC_BIND` | `127.0.0.1` | Interface the API binds to. Keep on loopback unless you know what you're doing. |
| `CC_API_PORT` | `8080` | API port. |
| `CC_WEB_PORT` | `4200` | Web UI port. |
| `CC_ENCRYPTION_KEY` | *(auto-generated on first run)* | Used to encrypt PATs at rest. Store this safely if you set it manually. |
| `CC_OFFLINE` | `true` | Hard-fails any code path that tries an outbound network call. **Do not disable** unless you've reviewed the change. |

---

## Troubleshooting

**`docker compose up` fails with `port 5432 already allocated`**
The DB is mapped to `15432` on purpose to avoid clashing with a host Postgres.
If you've changed it, pick another free port.

**The graph is empty after a scan**
- Confirm `CC_REPO_ROOTS` points to a directory that *is mounted into* the
  scanner container (`docker compose exec scanner ls /repos`).
- Check `docker compose logs scanner` — the scanners print every file they
  visit and skip.

**`scanner-dotnet` fails with `Could not load project ...`**
Roslyn workspaces need a *restored* solution. Run `dotnet restore` against
your solution **once** before scanning (we don't auto-restore — that would
violate the read-only constraint).

**`scanner-angular` says `tsconfig not found`**
Make sure each Angular project has a top-level `tsconfig.json`. For monorepos,
each app's `tsconfig.app.json` should `extends: ../../tsconfig.base.json`.

---

## Roadmap

See [`PLAN.md`](PLAN.md) for the full, grouped, MVP-by-MVP roadmap with status.

---

## License

MIT. See [`LICENSE`](LICENSE).
