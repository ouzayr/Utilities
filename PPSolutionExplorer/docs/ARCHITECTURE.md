# PP Solution Explorer – Technical Architecture

## 1. Overview

```
 Browser (Angular 20)                     .NET 9 process (127.0.0.1:5080)                         Local services
┌──────────────────────┐   /api/*    ┌───────────────────────────────────────────┐
│ imports / flow viewer│ ──────────► │ Api  (minimal APIs, static UI hosting)    │
│ search / impact      │             │  ├─ Parsers   (zip/JSON → ComponentGraph) │
│ node panel, AI panels│ ◄────────── │  ├─ Core      (graph, paths, rules)       │
└──────────────────────┘   JSON/SSE  │  ├─ Persistence (EF Core) ────────────────┼──► PostgreSQL 16 (127.0.0.1:5432)
                                     │  ├─ Ai (ILlmClient, prompts, redaction) ──┼──► llama-server (127.0.0.1:8080, optional)
                                     │  └─ AiJobWorker (background queue)        │
                                     └───────────────────────────────────────────┘
```

Single process, single user, loopback only. The Angular build is served from `src/Api/wwwroot` in production; in development `ng serve` proxies `/api` to the backend.

### Project dependencies

```
Core  ◄── Parsers
  ▲  ◄── Ai ◄── Persistence (implements IAiOutputStore)
  └──────────────── Api (references all)
```

`Core` has no I/O. `Ai` knows nothing about EF; it defines `IAiOutputStore`, which `Persistence.AiStore` implements.

## 2. Domain model (`src/Core/Model`)

| Type | Notes |
|---|---|
| `GraphNode(Id, Type, Name, ParentId, Branch, SubType, RawJson, Properties, Order)` | `RawJson` keeps the source verbatim. Containers store their JSON without nested action collections (children have their own). |
| `GraphEdge(SourceId, TargetId, Type, Status, Expression)` | `Status` is a `[Flags] RunStatus` for `RunsAfter`. Duplicate edges are merged (status OR'd). |
| `UnresolvedReference(NodeId, RawExpression, Reason)` | Anything that cannot be resolved statically. |
| `ComponentGraph` | In-memory graph with children/descendant helpers, placeholder handling, warnings. |

**Node types:** Solution, Flow, Trigger, Action, Scope, Condition, Loop, Switch, App, Table, Column, Relationship, EnvVariable, ConnectionReference, Connector, Unknown.
**Edge types:** RunsAfter, DataFlow, Reads, Writes, Calls, Triggers, UsesEnvVar, UsesConnection, Contains.

**Deterministic IDs** (`NodeIds`) make tags/notes survive re-imports:

| Node | ID pattern |
|---|---|
| Solution | `sol:<uniquename>` |
| Flow | `flow:<workflow guid>` |
| Trigger / Action | `flow:<guid>/trigger:<name>` / `flow:<guid>/action:<name>` (action names are unique per definition) |
| Table / Column | `table:<logical or set name>` / `column:<table>.<column>` |
| EnvVariable / ConnectionReference / Connector / App | `env:<schema>` / `connref:<logical>` / `connector:<api>` / `app:<name>` |

Edge direction conventions: `RunsAfter` predecessor → successor; `DataFlow` producer → consumer; `Reads/Writes/UsesEnvVar/UsesConnection/Calls` user → dependency; `Triggers` table → flow; `Contains` parent → child.

**Placeholders**: a referenced but undefined node (external child flow, table not in the solution) is added with `placeholder=true`; a real definition replaces it.

## 3. Parsing (`src/Parsers`)

`ImportParser.Parse(stream, fileName)` detects the format by magic bytes:

| Input | Handler |
|---|---|
| Zip with `solution.xml` | `SolutionZipParser.ParseSolution` |
| Zip with `Microsoft.Flow/flows/*/definition.json` | legacy package (uses `manifest.json` for names) |
| Anything else | flow JSON (`{properties:{definition}}`, `{definition}` or bare definition) |

**Zip safety** (`SafeZipReader`): entries read into memory only (no extraction → no path traversal), 100 MB per entry, 1 GB total, 50k entries. XML parsed with DTD processing prohibited and no resolver (no XXE).

**Solution layout assumed** (verify against real exports): `solution.xml` (UniqueName, Version, Managed), `customizations.xml` (`Workflow` elements with `JsonFileName`, `Category=5` for cloud flows; `connectionreference`; `Entity` with attributes and `EntitySetName`; `EntityRelationship`; `CanvasApp`; `AppModule`), `environmentvariabledefinitions/<schema>/environmentvariabledefinition.xml` + `environmentvariablevalues.json`. Secret-type env vars (100000005) never store a value. Workflow JSON files not listed in `customizations.xml` are parsed with a warning when the file name carries a GUID.

**Flow definition** (`FlowDefinitionParser`):
- Nesting: Scope/Foreach/Until → `actions`; If → `actions` (branch `true`) + `else.actions` (branch `else`); Switch → `cases.<name>.actions` (branch `case:<name>`) + `default.actions` (branch `default`).
- Unknown action types → `NodeType.Unknown` with raw JSON. Never throws.
- `runAfter` → `RunsAfter` edges with statuses. A `runAfter` to a non-sibling is unresolved.
- Connections: `properties.connectionReferences` (solution: `connection.connectionReferenceLogicalName`; legacy: `id`) and `inputs.host.connectionName` / legacy `host.connection.name` (`['key']` indexer).
- Child flows: `type: Workflow` + `host.workflowReferenceName` → `Calls`.
- Env variables: `parameters('X')` resolved through `definition.parameters[X].metadata.schemaName`. No schemaName → unresolved (no guessing from the display name).

**Expressions** (`ExpressionScanner`): finds `@...` and every `@{...}` interpolation (`@@` escapes ignored), then `body|outputs|actions|result|items|variables|parameters('literal')`, `triggerBody|triggerOutputs|trigger()`, `workflow()`. Only literal single-quoted arguments resolve; `body(variables('x'))` is unresolved. Function names inside string literals are ignored. Variables resolve to the `InitializeVariable` action that declares them.

**Dataverse** (`DataverseActionAnalyzer`): `shared_commondataserviceforapps` operations classified into Read / Write / Trigger. Columns from `$select`, `$filter` (comparisons and `contains/startswith/endswith`, values and `@{}` stripped first), `$orderby`, `item/<column>` (incl. `@odata.bind` lookups), trigger `filteringattributes`. Dynamic table names / column lists → unresolved. `TableNameResolver` maps entity-set → logical name only from solution metadata.

**Golden files**: `tests/fixtures/golden/*.graph.txt` is a canonical sorted dump of the parsed sample. `UPDATE_GOLDEN=1` rewrites it; review the diff.

## 4. Path tracing (`src/Core/Paths`)

1. `ExecutionGraph` builds a control-flow graph per flow:
   - Each action list (flow root, scope body, branch, case) is a *block*. Steps with no `runAfter` start from the block entry; a step links to the block exit unless something runs after its **success** (steps followed only by failure handlers still end the block on success).
   - Containers get a virtual `<id>#end` node. Condition → `true`/`else` blocks; Switch → each case + default (empty or missing branches link straight to end). Loops: body once, node flagged as loop.
   - Single virtual `#exit` for the flow. Entry = trigger.
   - `IncludeFailureBranches=false` drops edges whose status set is only Failed/TimedOut (steps reachable only that way become unreachable).
2. **Count** with memoised DFS (DP over the DAG), saturating at `long.MaxValue`. Cycles (malformed input) are broken and reported as warnings.
3. **Enumerate** with DFS, pruned by the DP counts, stopping at `MaxPaths` (default 10,000, API cap 100,000).
4. Result: `total_estimated`, `returned`, `truncated`, paths (`steps` with branch and via-status, `iterated`, `usesFailureBranch`). Virtual nodes are removed from output.

A property test checks DP count == enumerated count on 200 random nested DAGs.

## 5. Persistence (`src/Persistence`)

PostgreSQL via EF Core 9 + Npgsql; snake_case columns; migrations in `Persistence/Migrations`, applied at startup (`Database:MigrateOnStartup`).

| Table | Key | Purpose |
|---|---|---|
| `imports` | `id` | One per upload: kind, name, version, file name, SHA-256, counts, warnings (jsonb). |
| `nodes` | `(import_id, id)` | Graph nodes. `raw_json` is `text` (verbatim), `properties` jsonb, denormalised `connector`, `operation` for facets. |
| `edges` | `id` | Graph edges per import. Indexed on `(import_id, source_id)` and `(import_id, target_id)`. |
| `unresolved_references` | `id` | Raw expression + reason. |
| `tags`, `notes` | `id` | Sidecar annotations keyed by **node id** (not import) → survive re-import. Unique `(node_id, tag)`. |
| `ai_outputs` | `id` | Content + model, prompt name/version, cache key, `ai_status`, error, timestamp. |
| `ai_jobs` | `id` | Background job state and progress. |

Deleting an import cascades to its nodes/edges/unresolved, keeps tags/notes.

**Graph queries** (`GraphStore`):
- *Flow subgraph*: recursive CTE over `parent_id` from the flow node, plus edges touching those nodes and the external nodes they reference.
- *Impact*: recursive CTE following reverse dependency edges (`Reads, Writes, UsesEnvVar, UsesConnection, Calls`), forward `DataFlow`/`Triggers`, and `Contains` from a table to its columns; depth-capped (default 6, max 20); `DISTINCT ON (id)` keeps the shortest depth and its edge type. Flow names resolved from the ID prefix.
- *Search*: composed EF LINQ (`ILIKE` with escaped wildcards, `IN` lists, `EXISTS` on edges/tags/unresolved). All input is parameterised; the AI never produces SQL.
- Neo4j is not used; revisit only if path/impact queries become a bottleneck (`CLAUDE.md`).

## 6. API (`src/Api`)

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness. |
| `POST /api/imports` (multipart `file`) | Parse + store. Returns import summary. |
| `GET /api/imports`, `GET/DELETE /api/imports/{id}` | List, get, delete (our copy only). |
| `GET /api/imports/{id}/nodes?type=` | Nodes of a type with tags. |
| `GET /api/imports/{id}/node?nodeId=` | Full node detail: properties, raw source, edges, unresolved, tags, notes, AI outputs. |
| `GET /api/imports/{id}/flow-graph?flowId=` | Nodes/edges for the viewer. |
| `POST /api/imports/{id}/paths` | `{flowId, fromNodeId?, toNodeId?, includeFailureBranches?, maxPaths?}`. |
| `GET /api/imports/{id}/impact?nodeId=&depth=` | Impact analysis. |
| `GET /api/imports/{id}/quality?flowId=` | Rule findings. |
| `GET /api/imports/{id}/facets` | Known values for search/AI validation. |
| `POST /api/search` | Structured `SearchQuery`; unknown facet values are dropped and reported. |
| `GET/POST /api/tags`, `DELETE /api/tags/{id}` | Tags. |
| `GET/POST /api/notes`, `PUT/DELETE /api/notes/{id}` | Notes. |
| `GET /api/imports/{id}/docs?format=md|html&flowId=&includeAi=&includeEnvValues=` | Documentation export (file download). |
| `GET /api/ai/status` | Enabled/reachable/model/prompts. |
| `POST /api/ai/jobs` `{kind, importId, nodeId}` | Queue `flow-summary`, `action-description`, `tag-suggestions`, `quality-explanation` (nodeId `<node>#<ruleId>`). 202 + job. |
| `GET /api/ai/jobs[/{id}]`, `GET /api/ai/outputs?nodeId=` | Job status, outputs. |
| `GET /api/ai/describe/stream?importId=&nodeId=` | SSE stream of a step description. |
| `POST /api/ai/search` `{question, importId}` | NL → validated `SearchQuery` + results. |
| `POST /api/ai/outputs/{id}/accept-tag` `{tag}` | Accept one suggested tag (must be in that suggestion). |

Errors are JSON `{status, title}`: 400 invalid input/archive, 404 missing, 502 model server failure, 503 AI disabled. Enums serialise as strings. Security headers: CSP (`script-src 'self'`), `nosniff`, `X-Frame-Options: DENY`, `no-referrer`. Upload size: `Upload:MaxBytes`.

## 7. AI layer (`src/Ai`)

### Components

| Component | Responsibility |
|---|---|
| `ILlmClient` | `CompleteAsync`, `StreamAsync`, `CountTokensAsync`, `ModelNameAsync`, `HealthAsync`. Everything depends on this; swap the provider by registering another implementation. |
| `LlamaCppClient` | `/v1/chat/completions` (with `response_format: json_schema`), SSE streaming, `/tokenize`, `/health`, `/v1/models`. Refuses non-loopback `BaseUrl`; HTTP handler has `UseProxy=false`. |
| `DisabledLlmClient` | Registered when `Ai:Enabled=false`; no HTTP client exists at all. |
| `PromptLibrary` | Loads `prompts/*.prompt.json` (name, version, system, user template, schema). |
| `Redactor` | Env var values → `[ENV:schema]`, JWT/bearer/`password=`/`sig=` → `[TOKEN]/[SECRET]`, Dataverse/SharePoint/onmicrosoft URLs → `[TENANT]`, emails → `[EMAIL]`, GUIDs → stable `[ID-n]`, plus configurable regexes. |
| `StepRenderer` | Compact text per step (type, connector/operation, runAfter, tables, redacted inputs ≤1,500 chars) inside `<flow_data>` fences; delimiter injection neutralised. |
| `Chunker` | Packs whole step blocks under a token budget measured with the server tokenizer. Never splits a step; an oversized step is truncated in its own chunk. |
| `SchemaValidator` | Validates model JSON (type, required, additionalProperties, enum, maxLength, maxItems, items). |
| `AiRunner` | Cache lookup → call (temperature clamped to 0–0.2 for structured) → validate → retry once → store with provenance or `ai_status=failed`. |
| `FlowSummaryService` | Hierarchical map-reduce summary. |
| `StepAiService` | Description (structured + streamed), tag suggestions, NL search, quality explanation. |
| `AiJobWorker` (Api) | `Channel`-based queue, one worker per `ParallelSlots`, progress updates, marks interrupted jobs failed at startup. |

### Token budget
`slot = ContextSize / ParallelSlots` (default 16,384). Input budget per call = `slot − tokens(system + template) − maxOutputTokens − 5% safety`.

### Hierarchical flow summary
```
summarise(container):
    blocks = for child in children: render(child, child is container ? summarise(child) : null)
    chunks = pack(blocks, scopeBudget)           # step boundaries only
    parts  = [scope-summary(chunk) for chunk]    # leaf scopes first (post-order)
    return parts.single or combine-summaries(parts)  # recursive if still too big
flow-summary(root blocks or root partials) → {purpose, summary, keySteps[], risks[]}
```
Every intermediate call is stored as a `scope-summary` output for that container (visible in the UI and reused via cache).

### Caching
`cache_key = SHA-256(promptName@version + model + system + rendered user message)`. Any prompt change must bump its version.

### Prompt-injection controls
Flow content is wrapped in `<flow_data>` and the system prompt says it is data; delimiter look-alikes in content are rewritten; output is schema-constrained and re-validated; NL search values are checked against known facets; tag "inVocabulary" is recomputed; quality findings are recomputed server-side from the rule id (client text is not trusted); AI output never triggers actions (tags need an explicit accept).

## 8. Frontend (`web/`)

Angular 20, standalone components, signals, strict TS, lazy routes, `withComponentInputBinding` (route/query params bound to inputs).

| Route | Component |
|---|---|
| `/` | `ImportsPage` – upload, list, delete |
| `/imports/:importId` | `ImportDetailPage` – flows, env vars, connection refs, tables, apps, doc export |
| `/imports/:importId/flow?flowId=&nodeId=` | `FlowViewerPage` – Cytoscape + ELK (layered, `INCLUDE_CHILDREN`), path tracing, quality, `NodePanelComponent` |
| `/imports/:importId/search` | `SearchPage` – facets + AI question box |
| `/imports/:importId/impact?nodeId=` | `ImpactPage` |

`flow-elements.ts` (unit-tested) converts the graph to Cytoscape elements: containers are compound nodes, condition/switch branches are compound "lanes", root steps get an implicit edge from the trigger, failure-only `runAfter` edges are red dashed, data flow is an optional overlay. Cytoscape/ELK (~460 kB gzip) load only on the flow page; initial bundle ~86 kB gzip. `AiOutputComponent` always shows model, prompt and timestamp in a dashed purple frame. Production build disables critical-CSS inlining because its inline `onload` handler violates the CSP.

## 9. Security summary

| Concern | Control |
|---|---|
| Data exfiltration | Loopback binding, loopback-only AI URL check, proxy bypass for AI, no other HTTP clients, CSP `connect-src 'self'`. |
| Customer assets | Files parsed in memory, never written to disk or back to an environment. |
| Malicious archives | Size/entry caps, no extraction, DTD prohibited. |
| SQL injection | EF parameters; interpolated raw SQL uses `FromSqlInterpolated`/`SqlQuery` (parameterised). |
| XSS | Angular escaping; doc HTML export HTML-encodes all values. |
| Secrets in DB | Secret env vars not stored; values excluded from docs by default; DB is local. |
| Authentication | None (single-user local tool). Do not expose on a network; put behind an authenticating reverse proxy if that ever changes. |

## 10. Testing

| Suite | Scope |
|---|---|
| `Parsers/*` | Golden file for the sample solution; nesting/branches; unknown types; entity-set mapping; unresolved handling; expression scanner; Dataverse analyzer. |
| `Core/*` | Path tracer (parallel branches, failure toggle, cap, nested sample, between steps, DP==enumerated property test); quality rules. |
| `Ai/AiLayerTests` | Prompt library, loopback guard, redactor, schema validator, retry→failed, provenance + cache, hierarchical summary order + no leaks, chunking on step boundaries + combine, NL search validation, tag vocabulary recheck. Fake `ILlmClient`. |
| `Persistence/GraphStoreTests` (`Category=Postgres`) | CTE subgraph round-trip, impact, search filters, facets. Self-skip unless `PPSE_TEST_CONNECTION`. |
| `Ai/LlamaLiveTests` (`Category=LlamaLive`) | Real server health, tokenize, schema-constrained output. Excluded by the default filter. |
| `web` (Karma) | `toElements` conversion. |

## 11. Extension points

- **New provider**: implement `ILlmClient`, register it instead of `LlamaCppClient` in `AddExplorerAi`.
- **New quality rule**: add a method in `QualityRules.Evaluate` with a new `PPSE0xx` id.
- **New AI use case**: add `prompts/<name>.prompt.json`, a service method calling `AiRunner.RunStructuredAsync`, and a job kind in `AiJobWorker`.
- **Semantic search (later)**: run `llama-server --embedding`, add pgvector, store embeddings per node with prompt/model metadata.
- **Schema changes**: edit entities/DbContext, then `dotnet ef migrations add <Name> -p src/Persistence -s src/Persistence -o Migrations`.
