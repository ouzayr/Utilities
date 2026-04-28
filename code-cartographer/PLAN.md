# code-cartographer — Plan & Roadmap

**Stack:** Angular 17 (UI) + .NET 8 (API + .NET scanner) + Node 20 / ts-morph
(Angular scanner) + PostgreSQL 16 + Cytoscape.js for graph rendering.

**Deployment:** Local-only. Docker Compose or `dotnet`/`npm` directly.

**Constraints (locked in with the user 2026-04-28):**

- Read-only against source repos (never write back, never auto-fix, never
  commit).
- Static analysis only (never execute user code).
- Fully offline at runtime (no telemetry, no LLM calls, no package fetches).
  Build-time package downloads are fine.
- Current working tree only (no git history scanning).
- No SaaS integrations (Slack / Teams / Jira / etc.).
- Single user, localhost — no auth in the UI.

---

## 1. Data model (the unified graph)

Every node has:

| Field | Description |
|---|---|
| `id` | stable, deterministic — e.g. `ui:component:OrderListComponent@apps/ui/src/app/orders` |
| `kind` | see table below |
| `side` | `ui` \| `api` |
| `project` | logical project key (one Angular app or one .csproj) |
| `name` | short symbolic name |
| `fqName` | fully qualified name (incl. namespace / module path) |
| `filePath` | repo-relative file path |
| `line` | 1-based |
| `meta` | kind-specific bag (route, verb, dto refs, etc.) |
| `metrics` | LOC, cyclomatic complexity, fan-in, fan-out, etc. |

**Node kinds**

| Side | Kind |
|---|---|
| ui | `ng-component`, `ng-service`, `ng-module`, `ng-route`, `ng-pipe`, `ng-directive`, `ng-guard`, `ng-interceptor`, `ng-resolver`, `ng-model`, `ng-style` |
| api | `dotnet-controller`, `dotnet-action`, `dotnet-endpoint`, `dotnet-service`, `dotnet-interface`, `dotnet-repository`, `dotnet-dto`, `dotnet-entity`, `dotnet-method`, `dotnet-handler`, `dotnet-validator`, `dotnet-middleware` |

Every edge has `id`, `source`, `target`, `kind`, `meta`. Edge kinds:
`imports`, `injects`, `calls`, `http-call`, `route-handler`, `extends`,
`implements`, `declares`, `registers`, `uses-dto`, `returns`, `routes-to`,
`renders`, `binds`.

The cross-link engine produces `http-call` and `route-handler` edges between
sides — that's the magic that makes UI↔API tracing work.

---

## 2. MVPs & feature status

Legend: `[x]` shipped, `[~]` in progress / partial, `[ ]` planned.

### MVP-1 — Foundational scan & visualise

| # | Feature | Status | Notes |
|---|---|---|---|
| 1.1 | Repo browser: pick local folders, tag UI / API / both | [~] | Scaffolded; UI needs polish |
| 1.2 | Angular scanner: components, services, modules, routes, pipes, directives, guards, interceptors, resolvers, models | [~] | Components/services/HTTP calls done in scaffold; rest stubbed |
| 1.3 | .NET scanner: controllers, actions, services, interfaces, repositories, DTOs, entities, DI registrations, attribute routes, minimal APIs | [~] | Controllers/actions/services/interfaces/DTOs done in scaffold |
| 1.4 | Per-side dependency graph (UI only / API only) | [x] | Cytoscape view |
| 1.5 | Filter panel: by kind, by project, by file glob | [~] | Kind & project filters done |
| 1.6 | PostgreSQL persistence + REST ingest endpoint | [x] | EF Core migrations included |
| 1.7 | Re-scan button + scan history list | [~] | Backend done; UI list pending |
| 1.8 | Synthetic sample Angular + .NET app for validation | [x] | Lives under `samples/` |

### MVP-2 — Cross-stack linking & flow tracing

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.1 | Match Angular `HttpClient.*` calls to .NET route templates (incl. `[Route]`, `[ApiController]`, `[HttpGet("foo/{id}")]`, route prefixes, attribute composition, `MapGet`/`MapPost`) | [~] | Initial matcher in `api/CrossLink.cs`; handles ~80% of conventions |
| 2.2 | Joint UI+API graph view with `ui→api` edges colour-coded | [x] | |
| 2.3 | "Click a UI component → show full downstream flow to controllers / services / repositories" | [~] | Backend BFS done; linear-flow renderer pending |
| 2.4 | "Click an API endpoint → show full upstream flow back to UI" | [~] | Same as 2.3 |
| 2.5 | Multi-project selection (pick UI projects + API projects to combine) | [ ] | |
| 2.6 | Bookmarks: save a named view (selection + filters + layout) | [ ] | |

### MVP-3 — Code-quality & best-practice analysis

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.1 | Dead-code: unused Angular components, services, pipes, directives, modules, routes | [ ] | |
| 3.2 | Dead-code: unused .NET controllers, actions, services, DTOs, public methods | [ ] | |
| 3.3 | Dead-code: orphan API endpoints (zero UI callers) | [~] | Cross-link engine already produces this signal |
| 3.4 | SCSS / CSS hygiene: unused classes, deeply nested selectors, `!important` overuse, oversized files, missing variables | [ ] | |
| 3.5 | Layering lint (UI): components calling `HttpClient` directly, services importing from `pages/`, circular DI | [ ] | |
| 3.6 | Layering lint (API): controllers calling repositories directly, services with EF DbContext, circular DI, fat controllers | [ ] | |
| 3.7 | Security smells: endpoints missing `[Authorize]`, wide CORS, SQL string concat, secrets-in-code regex, Angular `bypassSecurityTrust*` | [ ] | |
| 3.8 | Performance smells: N+1 EF (`Include` heuristics), sync-over-async, missing `OnPush`, `ngFor` without `trackBy`, oversized bundles | [ ] | |
| 3.9 | Architecture report: one-click Markdown summary suitable for a wiki | [ ] | |

### MVP-4 — Insights, diffs & impact

| # | Feature | Status | Notes |
|---|---|---|---|
| 4.1 | Impact analysis: "if I change node X, what breaks?" (transitive consumers) | [ ] | |
| 4.2 | Snapshot diff: compare scan A vs scan B (added / removed / changed nodes & edges). Pure DB diff — no git history. | [ ] | |
| 4.3 | Test-coverage overlay: import xUnit / Coverlet `coverage.cobertura.xml` and Karma / Jasmine `lcov.info`, colour the graph | [ ] | |
| 4.4 | Hotspot map: nodes scaled by churn-proxy = file size × fan-in × fan-out (no git history needed) | [ ] | |
| 4.5 | Saved searches & alerts on next scan | [ ] | |

### MVP-5 — Integrations & power-user features

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.1 | Self-hosted CI gate: a single `code-cartographer scan --fail-on layering,security` CLI that returns non-zero on regressions. No SaaS calls. | [ ] | |
| 5.2 | VS Code companion: right-click any method → "Show flow" opens the graph filtered to that node. Local-only extension that talks to the API on `localhost`. | [ ] | |
| 5.3 | Neo4j optional storage adapter for very large monorepos | [ ] | |
| 5.4 | OpenAPI / Swagger import: enrich .NET endpoints with the canonical contract from a generated spec | [ ] | |
| 5.5 | Custom rule SDK: add your own analyser as a small TypeScript or C# plug-in | [ ] | |

### Explicitly out-of-scope (per user)

- AI / LLM summariser or auto-refactor suggestions.
- Slack / Teams / Jira / any SaaS push.
- Auto-fix or any kind of write-back to user repos.
- Git history walking (`git log`, `git blame`, comparing branches).
- Running user code (`dotnet run`, `npm start`, executing tests).
- Outbound network calls at runtime.
- Multi-user auth / SSO.

---

## 3. Where the code lives

```
code-cartographer/
├── apps/
│   ├── scanner-angular/   Node 20 + ts-morph + @angular/compiler
│   ├── scanner-dotnet/    .NET 8 console app, Microsoft.CodeAnalysis (Roslyn)
│   ├── api/               .NET 8 Web API + EF Core 8 + Npgsql
│   └── web/               Angular 17 standalone + Cytoscape + Tailwind
├── samples/
│   ├── sample-api/        Tiny .NET 8 API to validate the scanner
│   └── sample-ui/         Tiny Angular 17 app to validate the scanner
├── scripts/               dev launchers (bash + powershell)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   └── CROSS_LINKING.md
├── docker-compose.yml
├── .env.example
├── README.md
└── PLAN.md  (this file)
```

---

## 4. Definition of done for "MVP-1 shipped"

- `docker compose up` produces a running stack.
- Web UI loads at `localhost:4200` with no errors in the browser console.
- Clicking **Run scan** scans the bundled `samples/` and produces ≥ 30 nodes
  and ≥ 50 edges.
- The Angular sample's `OrderService.list()` HTTP call shows a `http-call`
  edge to the .NET sample's `OrderController.List` action.
- Filtering, basic Cytoscape layout, and node-detail side panel all work.
- All four containers run with **zero outbound network connections** during
  steady-state operation (verified with `docker run --network none` swap
  test).

MVP-2..5 will be tracked as separate PRs against this same folder.
