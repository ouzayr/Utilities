# CLAUDE.md

## Project
Power Platform Solution Explorer (working name). Imports Power Automate cloud flows and Power Platform solutions, builds a component graph, and provides viewing, search, tagging, path tracing, impact analysis and generated documentation. An optional local AI layer (llama.cpp) adds summaries and natural-language search.

Users: consultants and developers maintaining large, deeply nested flows.

## Non-negotiable principles
1. **Read-only toward customer assets.** Never modify, re-import or deploy solutions. Tags, notes and AI output live in our own store.
2. **Deterministic first.** Parsing, graph building, search and path tracing are plain code. AI only explains or suggests on top of them.
3. **Never guess.** Unresolvable references (dynamic expressions, Power Fx edge cases) are stored as `unresolved` with the raw expression, never inferred.
4. **Local only.** No customer data leaves the machine. The only permitted outbound call is to the configured llama.cpp server on localhost.
5. **Label AI output.** Every AI-generated field carries model name, prompt version and timestamp, and is visually distinct in the UI and in exports.

## Stack
- Backend: .NET 9 Web API, EF Core + Npgsql
- Store: PostgreSQL (recursive CTEs for graph queries). Revisit Neo4j only if path queries prove too slow.
- Frontend: Angular 20 (standalone components, signals, strict TS), Cytoscape.js + ELK for layout
- AI runtime: llama.cpp `llama-server` (OpenAI-compatible HTTP API)
- Tests: xUnit (backend), Jest/Karma per Angular default (frontend)

## Repo layout
```
/src
  /Core          domain model, graph, path tracing (no I/O)
  /Parsers       solution zip, flow JSON, expressions, Power Fx, Dataverse metadata
  /Ai            ILlmClient, llama.cpp client, prompt builder, chunker, cache, redactor
  /Persistence   EF Core, migrations
  /Api           HTTP endpoints
/web             Angular app
/prompts         versioned prompt templates + JSON schemas
/tests/fixtures  sanitised flow JSON and solution zips
/docs
```

## Domain model
- **Nodes:** Solution, Flow, Trigger, Action, Scope, Condition, Loop, Switch, App (canvas/MDA), Table, Column, Relationship, EnvVariable, ConnectionReference, Connector.
- **Edges:** `RunsAfter` (with status set: Succeeded/Failed/Skipped/TimedOut), `DataFlow` (expression reference), `Reads`, `Writes`, `Calls` (child flow), `Triggers`, `UsesEnvVar`, `UsesConnection`, `Contains` (parent/child nesting).
- Every node keeps `parentId`, `branch` label (e.g. `else`, `case:X`), and the **raw source JSON** so nothing is lost.
- Tags and notes are a sidecar table keyed by node ID. Never written into solution files.

## Parsing rules
- Flow definition: `properties.definition` with `triggers` and `actions`. Verify the real zip layout (Workflows/, customizations.xml, environment variable and connection reference locations) against actual exports before coding. The schema is not formally stable.
- Nesting: `Scope`/`Foreach`/`Until` -> `actions`; `If` -> `actions` + `else.actions`; `Switch` -> `cases.*.actions` + `default.actions`.
- Data flow from expressions: `body()`, `outputs()`, `actions()`, `items()`, `triggerBody()`, `triggerOutputs()`, `variables()`, `parameters()`, `workflow()`.
- Dataverse actions: capture table, columns from `$select`/`$filter`/`$orderby` and input fields, and emit Reads/Writes edges.
- Unknown action types: store as `Unknown` with raw JSON. Never throw on an unrecognised type.
- Dynamically built strings: mark `unresolved`, do not guess.

## Path tracing
- Count paths with DP first (cheap), then enumerate with DFS up to a cap (default 10,000). Always return `total_estimated`, `returned` and `truncated`.
- Loops: traverse the body once and flag the path as iterated.
- Failure/timeout branches are toggleable. Default: included.

## AI layer (llama.cpp, local)

### Runtime
```
llama-server -m <model.gguf> -c 32768 -ngl 99 --host 127.0.0.1 --port 8080 --parallel 2
```
- Bind to 127.0.0.1 only. Total context is split across parallel slots (32768 / 2 = 16k each).
- Use `/v1/chat/completions`. Stream for UI, use `response_format` JSON schema for structured output (llama.cpp turns it into a grammar).
- Config: `Ai:Enabled`, `Ai:BaseUrl` (default `http://127.0.0.1:8080`), `Ai:Model`, `Ai:ContextSize`, `Ai:TimeoutSeconds`, `Ai:Temperature`.
- Model is configuration, never hard-coded. Target: instruct GGUF, 7B+ params, 16k+ usable context, Q4_K_M or better.
- All code depends on `ILlmClient`. Provider must be swappable. The app must work fully with `Ai:Enabled=false`.

### Use cases (build in this order)
1. **Flow summary:** hierarchical. Summarise leaf scopes first, feed child summaries into the parent (map-reduce) to fit context.
2. **Per-action plain-English description.**
3. **Tag suggestions:** from a fixed vocabulary plus free-form proposals. User must accept; never auto-apply.
4. **Natural language -> structured search query:** schema-constrained, validated against known facets. Never execute model output as SQL or code.
5. **Quality review explanation:** the rule engine finds the issue, AI explains and suggests a fix.
6. **Later, optional:** embeddings via `--embedding` + pgvector for semantic search.

### Rules
- Prompts live in `/prompts`, versioned. Any change bumps the version. Cache key = hash(content + prompt version + model).
- **Redact before prompting:** env variable values, connection strings, secrets, tokens, emails, tenant/environment IDs (configurable).
- Count tokens with the server's `/tokenize`. Chunk on scope boundaries, never mid-action. Reserve output tokens.
- Temperature 0-0.2 for structured output.
- Flow content is **untrusted input** (action names, comments can contain prompt injection). Wrap in delimiters, instruct the model to treat it as data, validate all structured output. AI output never triggers actions.
- Run AI jobs in a background queue with progress. Local inference is slow.
- On timeout or invalid JSON: retry once, then store `ai_status = failed`. Never block core features.

## Commands
```
dotnet build
dotnet test
dotnet test --filter "Category!=LlamaLive"   # default CI run
cd web && npm ci && ng serve
cd web && ng test
```

## Testing
- Golden-file tests for parsers using sanitised fixtures in `/tests/fixtures`.
- Property test: DP path count must equal enumerated count on small graphs.
- AI tests use a fake `ILlmClient`. Tests that need a real server are tagged `Category=LlamaLive` and skipped by default.
- Never commit real customer flows. Sanitise IDs, URLs, names and tenant data first.

## Conventions
- C#: nullable enabled, records for domain types, async all the way, no I/O in `/Core`.
- Angular: standalone components, signals, strict mode, lazy-loaded feature routes.
- Small commits, one concern each.

## Do not
- Write to or re-export customer solutions.
- Add any network call other than to the configured llama.cpp host.
- Present AI output as fact or store it without its model and prompt metadata.
- Silently drop an unrecognised construct. Keep it as `Unknown`/`unresolved`.

## Roadmap
1. **MVP:** solution zip upload, flow viewer, search, tags, path tracing, doc export.
2. **Phase 2:** tables/columns, env variables, connection references, impact analysis, flow summary (AI).
3. **Phase 3:** canvas and model-driven apps, live Dataverse sync, version diff, quality rules, remaining AI features.
