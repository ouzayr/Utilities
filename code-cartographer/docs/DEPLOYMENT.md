# Deployment Guide

code-cartographer supports two deployment modes: Docker Compose (recommended
for quick start) and local bare-metal (recommended for development on Windows).

---

## Prerequisites

| Component | Version | Notes |
|---|---|---|
| PostgreSQL | 16+ | Can run via Docker even if everything else runs locally |
| .NET SDK | 8.0+ | Required for the API and .NET scanner |
| Node.js | 20+ | Required for the Angular scanner and web UI |
| npm | 10+ | Bundled with Node.js 20 |
| Docker + Compose | 24+ / v2+ | Only needed for the Docker deployment path |

---

## Option A — Docker Compose

```bash
cd code-cartographer
cp .env.example .env       # edit if needed
docker compose up -d       # starts db, api, web
```

The scanners are in the `scan` profile and run on-demand:

```bash
docker compose --profile scan run --rm scanner-angular
docker compose --profile scan run --rm scanner-dotnet
```

### Ports

| Service | Container port | Host port |
|---|---|---|
| PostgreSQL | 5432 | 15432 |
| API | 8080 | 8080 |
| Web (nginx) | 80 | 4200 |

### Data persistence

Database data is stored in the `cc_db_data` Docker volume. To reset:

```bash
docker compose down -v   # removes volumes
docker compose up -d
```

---

## Option B — Local (Windows / Linux / macOS)

### 1. Database

Run Postgres locally or use Docker for just the DB:

```bash
docker run --rm -d \
  --name cc-db \
  -e POSTGRES_USER=cc \
  -e POSTGRES_PASSWORD=cc \
  -e POSTGRES_DB=codecartographer \
  -p 15432:5432 \
  postgres:16
```

### 2. API

```bash
cd apps/api
dotnet restore
dotnet run
```

Reads config from `appsettings.json` — no environment variables needed.
The API auto-creates the database schema on first start (`EnsureCreated`).

### 3. Web UI

```bash
cd apps/web
npm install
npm start        # http://localhost:4200
```

The Angular dev server proxies `/api` requests to `http://localhost:8080`
via `proxy.conf.json`.

### 4. Scanners

Copy `cc-scan-config.example.json` → `cc-scan-config.json` in the project
root and edit the paths. Then:

```bash
# Angular scanner
cd apps/scanner-angular
npm install && npm run build
node dist/index.js

# .NET scanner
cd apps/scanner-dotnet
dotnet run
```

Both read `cc-scan-config.json` automatically. CLI flags override config values.

---

## Configuration reference

### API — `apps/api/appsettings.json`

| JSON path | Env variable | Default | Description |
|---|---|---|---|
| `ConnectionStrings:DefaultConnection` | `CC_DB_CONNECTION` | `Host=localhost;Port=15432;...` | Postgres connection string |
| `CodeCartographer:Bind` | `CC_BIND` | `127.0.0.1` | Network interface to bind to |
| `CodeCartographer:ApiPort` | `CC_API_PORT` | `8080` | API listen port |
| `CodeCartographer:Offline` | `CC_OFFLINE` | `true` | Block outbound network calls |

Environment variables take precedence over `appsettings.json`.

### Scanners — `cc-scan-config.json`

Searched in the current directory and up to 2 parent directories. Supports
per-scanner sections (`angular` / `dotnet`):

```json
{
  "angular": {
    "root": "./path/to/angular-project",
    "project": "my-ui",
    "apiBase": "http://localhost:8080",
    "out": "graph-angular.json"
  },
  "dotnet": {
    "root": "./path/to/dotnet-project",
    "project": "my-api",
    "apiBase": "http://localhost:8080",
    "out": "graph-dotnet.json",
    "finalize": true
  }
}
```

---

## Typical scan workflow

1. Start the database and API.
2. Open the web UI at `http://localhost:4200/#/repos`.
3. Add your Angular and .NET projects (use the Browse button for local folders).
4. Create a scan: `POST /api/scans` (or use the Scans page in the UI).
5. Run the Angular scanner, passing the scan ID.
6. Run the .NET scanner with `--finalize` (or `"finalize": true` in config).
7. Open the Dashboard to see KPIs, then explore the Graph, Flow, Endpoints,
   and Lint pages.

---

## Security notes

- The API binds to `127.0.0.1` by default. Do **not** expose it to the
  internet without authentication.
- The `/api/fs/browse` endpoint reads the local filesystem. This is by
  design for a localhost dev tool.
- If using GitHub/Azure DevOps repos with a PAT, the token is stored
  encrypted at rest using `CC_ENCRYPTION_KEY`.
- `CC_OFFLINE=true` (default) prevents any outbound network calls at
  runtime.
