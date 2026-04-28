# Architecture

## Goals
1. **Read-only static analysis** of an Angular UI repo and a .NET API repo (or
   many of each), unified into a single graph.
2. **Cross-stack linking** — an Angular component's `HttpClient.get('api/orders')`
   resolves to the .NET `OrderController.List` action, enabling UI↔API flow
   tracing.
3. **Best-practice findings** — dead code, layering, SCSS hygiene, security
   smells, perf smells, etc.
4. **Progression tracking** — every scan is stored as an immutable snapshot;
   a later scan can diff against any earlier one.
5. **Offline-first** — at runtime, the only outbound network call permitted is
   `git clone` / `git fetch` for repos the user explicitly added (and even that
   is off by default).

## Components

```
scanner-angular  ──┐
                   ├──► ingest API ──► PostgreSQL ──► query API ──► web UI
scanner-dotnet   ──┘                                      │
                                                          └──► CLI (CI gate)
```

### scanner-angular (Node 20)
- Uses `ts-morph` to parse TypeScript projects.
- Uses `@angular/compiler` to parse component templates.
- For each `*.ts`:
  - Detects Angular decorators (`@Component`, `@Injectable`, `@NgModule`,
    `@Pipe`, `@Directive`).
  - Resolves DI by reading constructor parameters' types and matching them to
    discovered `@Injectable` classes.
  - Walks the AST for `HttpClient.get|post|put|delete|patch|request` calls,
    extracting the URL expression (string literal, template literal, or
    concatenation), HTTP verb, and inferred request/response types.
  - Walks the `Routes` arrays (top-level, lazy, child) to build the route tree.
- For each `*.html`:
  - Parses to AST and pulls out `(click)`, `(input)`, `[ngIf]`, `[formGroup]`,
    pipes, custom directives, and child component selectors.
- For each `*.scss`/`*.css`:
  - Parses with PostCSS to find selectors, depth, `!important`, `@import`s.
- Emits a single `graph.json` with `{ nodes, edges, metrics, findings }`.

### scanner-dotnet (.NET 8)
- Uses `Microsoft.CodeAnalysis.MSBuild.MSBuildWorkspace` to load `.sln`/`.csproj`.
- For each compilation:
  - Walks for classes with `[ApiController]` / inheriting `ControllerBase`.
  - Extracts attribute routes (`[Route]`, `[HttpGet("...")]`, etc.) and
    composes them into a full route template per action.
  - Walks for minimal-API endpoint registrations (`app.MapGet("/foo", ...)`).
  - Detects services by DI registration (`AddScoped`, `AddSingleton`,
    `AddTransient`) and by interface convention (`I*` ↔ `*`).
  - Detects EF entities by DbContext `DbSet<T>` properties.
  - Detects DTOs by usage (action parameters / return types).
  - Builds the call graph by following `SymbolFinder.FindCallersAsync`.
- Emits the same `graph.json` schema.

### api (.NET 8 Web API)
- EF Core 8 + Npgsql.
- Endpoints (see `docs/API.md`):
  - `POST /api/scans` — start a scan job (server-side fork of the scanners).
  - `POST /api/graph/ingest` — accept a `graph.json` from a scanner.
  - `GET /api/scans` — list scans (most recent first, paginated).
  - `GET /api/scans/{id}/graph` — full graph.
  - `GET /api/scans/{id}/findings` — lint findings.
  - `GET /api/scans/{a}/diff/{b}` — snapshot diff.
  - `GET /api/flows/from/{nodeId}` — downstream / upstream BFS.
  - `GET /api/impact/{nodeId}` — full transitive consumer set.
  - `POST /api/scans/import` — accept a previously exported scan JSON.
  - `GET /api/reports/{id}/export?format=md|html|pdf|json` — render report.
  - `POST /api/repos`, `GET /api/repos`, `DELETE /api/repos/{id}` — repo CRUD.
- The cross-link engine runs server-side post-ingest: it walks every UI
  `http-call` edge, normalises the URL pattern, and matches it against the set
  of API route templates (see `docs/CROSS_LINKING.md`).

### web (Angular 17)
- Standalone components, signal-based stores.
- Cytoscape.js for the graph; Tailwind for layout.
- Pages: Dashboard, Repos, Graph, Flow, Endpoints, Lint, Diffs, Reports,
  Imports, Settings.

## Data flow

1. **Add repo** — user picks a local folder (or a remote URL if remote-fetch
   is enabled). API persists the entry in `repos`.
2. **Run scan** — API spawns scanners as child processes. They write
   `graph.json` to a temp directory.
3. **Ingest** — API normalises, deduplicates, runs cross-linker, runs lint
   rules, persists everything as a single immutable `scans` row + child
   `nodes`/`edges`/`findings` rows.
4. **Query** — UI requests slices. All slices come from Postgres (no live
   re-scanning at query time).
5. **Diff** — UI requests `/api/scans/{a}/diff/{b}`; API computes node and
   edge symmetric differences server-side.
6. **Export** — `GET /api/reports/{id}/export?format=...` renders the chosen
   slice into the requested format.
7. **Import** — user uploads an exported `scan.json`; it's deserialised,
   validated, and stored as a new (read-only) historical scan that subsequent
   diffs and progression analytics can use.

## Why these tech choices

- **Roslyn over reflection or text parsing** — semantic understanding of C# is
  the only way to get reliable DI and call graphs.
- **ts-morph over the TS compiler API directly** — same reason; `ts-morph`
  gives a much friendlier API on top of `typescript`.
- **PostgreSQL over SQLite** — the user picked it, and it scales much better
  for monorepos with hundreds of thousands of nodes/edges.
- **Cytoscape over D3 / Mermaid / React Flow** — purpose-built for large
  interactive graphs with multiple layouts (cose-bilkent, dagre, breadthfirst)
  and good performance up to ~50k nodes.
- **Angular 17 standalone** — matches the user's stack; no NgModule ceremony.
- **.NET 8 minimal API** — fastest path to a typed REST API on the user's stack.
