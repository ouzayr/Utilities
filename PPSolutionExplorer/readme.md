# PP Solution Explorer

Local tool for consultants and developers who maintain large, deeply nested **Power Automate cloud flows** and **Power Platform solutions**.
Import a solution export, see every flow as a graph, search across it, tag and annotate it, trace execution paths, check what breaks if something changes, and export documentation.

An optional local AI layer (llama.cpp) adds summaries, tag suggestions and plain-English search. **AI is off by default and the model is not chosen yet**; everything else works without it.

## At a glance

| | |
|---|---|
| What it reads | Solution export `.zip` (managed/unmanaged), legacy flow package `.zip`, single flow `.json` |
| What it never does | Modify, re-import or deploy customer solutions. Tags, notes and AI output live in its own database. |
| Where data goes | Nowhere. Runs on `127.0.0.1`. The only permitted outbound call is to a llama.cpp server on localhost. |
| Stack | .NET 9 Web API + EF Core/PostgreSQL · Angular 20 + Cytoscape.js/ELK · llama.cpp (optional) |
| Status | Roadmap **MVP complete**; parts of Phase 2/3 included (see below). 48 backend tests + 3 frontend tests passing. |

## Features

| Feature | What you get |
|---|---|
| **Import** | Parses solution zip in memory: `solution.xml`, `customizations.xml`, `Workflows/*.json`, environment variables, connection references, tables/columns, apps. Classic workflows/business rules are reported, not parsed. |
| **Flow viewer** | Interactive graph: scopes, loops, conditions (true/else lanes), switches (case lanes), runAfter edges (failure-only edges in red), optional data-flow overlay. Click any step for details and raw JSON. |
| **Search** | Text, action type/operation, connector, table, tag, "has unresolved references", optional raw-JSON search. |
| **Tags & notes** | Per component, stored in our DB, keyed by a stable ID so they survive re-imports. |
| **Path tracing** | Exact path count (DP) then enumeration up to a cap (default 10,000). From trigger or any step, to end or any step. Failure/timeout branches toggleable. Loops traversed once and flagged. |
| **Impact analysis** | "What is affected if X changes" for tables, columns, env variables, connection references, connectors, child flows. Recursive CTE in PostgreSQL. |
| **Quality rules** | Deterministic: no error handling, default step names, deep nesting, unresolved references, hard-coded GUIDs, unknown action types, List rows without `$top`. |
| **Documentation export** | Markdown or HTML per solution or per flow: overview, step tree, data access, dependencies, unresolved refs, quality findings, tags, notes. AI blocks clearly labelled. Env variable values excluded unless requested. |
| **AI (optional)** | Hierarchical flow summary, per-step description (streamed), tag suggestions (user must accept), natural language → validated structured search, explanation of quality findings. Every output carries model, prompt version, timestamp. |

### Core principles (from `CLAUDE.md`, enforced in code)

1. **Read-only** toward customer assets. Uploaded files are parsed in memory and discarded.
2. **Deterministic first.** Parsing, graph, search, path tracing, impact and rules are plain code. AI only explains.
3. **Never guess.** Dynamic expressions (e.g. `body(variables('x'))`, computed table names) are stored as `unresolved` with the raw expression.
4. **Local only.** Server binds to `127.0.0.1`; the AI client refuses any non-loopback URL and bypasses proxies.
5. **AI output is labelled** in the UI, API and exports.

## Quick start (developer machine)

Prerequisites: .NET 9 SDK, Node 22, PostgreSQL 16 (or Docker).

```bash
# 1. Database (Docker) – or use an existing local PostgreSQL, see docs/DEPLOYMENT.md
cp deploy/.env.example deploy/.env          # set PPSE_DB_PASSWORD=ppse for dev
docker compose -f deploy/docker-compose.yml up -d db

# 2. Backend (applies migrations on start, listens on http://127.0.0.1:5080)
dotnet run --project src/Api                # uses appsettings.Development.json

# 3. Frontend (dev server with /api proxy, http://localhost:4200)
cd web && npm ci && npx ng serve
```

Open http://localhost:4200, upload a solution `.zip`, open a flow.
A sanitised sample lives in `tests/fixtures/solutions/SampleSolution` (zip the folder contents to try it).

## Commands

```bash
dotnet build
dotnet test --filter "Category!=LlamaLive"          # default run; Postgres tests self-skip unless PPSE_TEST_CONNECTION is set
PPSE_TEST_CONNECTION="Host=127.0.0.1;Database=ppse_test;Username=ppse;Password=ppse" dotnet test --filter "Category!=LlamaLive"
dotnet test --filter "Category=LlamaLive"            # needs a running llama-server
cd web && npx ng test --watch=false                  # needs Chrome/Chromium (CHROME_BIN)
UPDATE_GOLDEN=1 dotnet test                          # regenerate parser golden files, then review the diff
scripts/publish.sh linux-x64 | scripts/publish.ps1 -Rid win-x64   # production build
```

## Repository layout

```
src/Core          domain model, graph, path tracing, quality rules, search model (no I/O)
src/Parsers       solution zip, flow JSON (WDL), expressions, Dataverse actions
src/Ai            ILlmClient, llama.cpp client, prompt library, redactor, chunker, schema validator, AI services
src/Persistence   EF Core DbContext, migrations, graph/annotation/AI stores (recursive CTEs)
src/Api           minimal-API endpoints, doc generator, AI background queue, static hosting of the UI
web/              Angular 20 app (standalone components, signals, strict TS, lazy routes)
prompts/          versioned prompt templates + JSON schemas
tests/            xUnit tests; fixtures/ (sanitised) and golden/ files
deploy/           docker-compose, systemd units, .env template
scripts/          publish scripts (bash, PowerShell)
docs/             ARCHITECTURE.md (technical), DEPLOYMENT.md (step-by-step deployment)
```

## Configuration (most used)

| Key | Default | Notes |
|---|---|---|
| `ConnectionStrings:Explorer` | local `ppse` DB | Put real secrets in `appsettings.Local.json` (git-ignored) or env var `ConnectionStrings__Explorer`. |
| `Urls` | `http://127.0.0.1:5080` | Keep on loopback. |
| `Upload:MaxBytes` | 200 MB | Request size cap. |
| `Database:MigrateOnStartup` | `true` | Applies EF migrations at start. |
| `Ai:Enabled` | `false` | Turn on once a model is chosen. |
| `Ai:BaseUrl` / `Ai:Model` | `http://127.0.0.1:8080` / empty | Model empty = ask the server. Must be loopback. |
| `Ai:ContextSize` / `Ai:ParallelSlots` | 32768 / 2 | Must match `llama-server -c` and `--parallel`. |
| `Ai:Redaction:*` | all on | Env var values, secrets, emails, GUIDs, tenant URLs, extra regexes. |

Full reference: `docs/DEPLOYMENT.md` §7.

## Known limitations (honest list)

- **Export layout is assumed, not certified.** The parser follows the documented/observed solution layout. Validate against a few real exports from your tenants before relying on it; unknown constructs are kept as `Unknown`, never dropped.
- Table names in actions are entity-set names (`contacts`). They are mapped to logical names (`contact`) **only** when the table's metadata is in the same solution; otherwise kept as-is.
- Path tracing works within one flow; it does not follow into child flows (the `Calls` edge is shown and used by impact analysis).
- Power Fx / canvas app internals, live Dataverse sync and version diff are **not implemented** (Phase 3).
- No authentication: it is a single-user local tool bound to loopback. Do not expose it on a network.
- Docker image build and the `llama` compose profile were not executed in the build environment; the native publish path was tested end-to-end.
- AI was verified end-to-end against a protocol-compatible stub server, not a real model. Quality of AI output depends on the model you pick.

## Roadmap status

| Phase | Item | Status |
|---|---|---|
| MVP | Solution zip upload, flow viewer, search, tags, path tracing, doc export | Done |
| 2 | Tables/columns, env variables, connection references, impact analysis | Done |
| 2 | Flow summary (AI) | Done (needs a model) |
| 3 | Quality rules + AI explanation, per-action description, tag suggestions, NL search | Done (rules engine is basic) |
| 3 | Canvas/model-driven app internals, Power Fx, live Dataverse sync, version diff | Not started |
| Later | Embeddings + pgvector semantic search | Not started |

## Further reading

- `docs/ARCHITECTURE.md` – components, data model, algorithms, AI pipeline, security.
- `docs/DEPLOYMENT.md` – step-by-step installation on Windows/Linux, Docker, enabling AI, operations, troubleshooting.
- `CLAUDE.md` – the project rules this implementation follows.
- `prompts/README.md` – prompt versioning rules.
