# Graph Schema

This document is the canonical reference for the `graph.json` format — the
contract between scanners and the API's ingest endpoint.

All three codebases (scanner-angular, scanner-dotnet, api) implement this
schema. If you change the schema, **update all three**.

---

## Top-level structure

```jsonc
{
  "schemaVersion": 1,
  "side": "ui",                    // "ui" or "api"
  "project": "sample-ui",         // logical project key
  "scannedAt": "2026-05-01T12:00:00Z",
  "nodes": [ /* GraphNode[] */ ],
  "edges": [ /* GraphEdge[] */ ],
  "findings": [ /* Finding[] */ ],
  "metrics": {
    "filesScanned": 142,
    "msTaken": 873
  }
}
```

---

## GraphNode

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Stable, deterministic. Format: `{side}:{kind}:{fqName}@{project}` |
| `kind` | string | yes | See node-kind table below |
| `side` | string | yes | `"ui"` or `"api"` |
| `project` | string | yes | Logical project key (e.g. folder name) |
| `name` | string | yes | Short symbolic name (e.g. `OrderListComponent`) |
| `fqName` | string | yes | Fully qualified name (e.g. `src/app/orders/order-list.component.ts#OrderListComponent`) |
| `filePath` | string | yes | Repo-relative file path |
| `line` | int | no | 1-based line number of the declaration |
| `meta` | object | yes | Kind-specific metadata (route, verb, DTO refs, etc.) |
| `metrics` | object | no | Computed metrics (LOC, fan-in, fan-out, cyclomatic complexity) |

### Node kinds

#### UI side (emitted by `scanner-angular`)

| Kind | What it represents |
|---|---|
| `ng-component` | Angular `@Component` class |
| `ng-service` | Angular `@Injectable` class |
| `ng-module` | Angular `@NgModule` class |
| `ng-route` | Route definition (from `Routes` array) |
| `ng-pipe` | Angular `@Pipe` class |
| `ng-directive` | Angular `@Directive` class |
| `ng-guard` | Route guard (`CanActivate`, etc.) |
| `ng-interceptor` | HTTP interceptor |
| `ng-resolver` | Route resolver |
| `ng-model` | TypeScript interface/class used as a data model |
| `ng-style` | SCSS/CSS file analysis node |

#### API side (emitted by `scanner-dotnet`)

| Kind | What it represents |
|---|---|
| `dotnet-controller` | `[ApiController]` / `ControllerBase`-derived class |
| `dotnet-action` | Controller action method with route attribute |
| `dotnet-endpoint` | Minimal API endpoint (`app.MapGet(...)`) |
| `dotnet-service` | DI-registered service class |
| `dotnet-interface` | Service interface (e.g. `IOrderService`) |
| `dotnet-repository` | Repository class (convention: name contains `Repository`) |
| `dotnet-dto` | DTO class (used as action parameter or return type) |
| `dotnet-entity` | EF entity class (discovered via `DbSet<T>`) |
| `dotnet-method` | Non-action public method on a service |
| `dotnet-handler` | Handler class (e.g. MediatR handler) |
| `dotnet-validator` | Validation class (e.g. FluentValidation) |
| `dotnet-middleware` | Middleware class |

---

## GraphEdge

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Format: `{kind}\|{sourceId}->{targetId}` (optional `\|{suffix}`) |
| `source` | string | yes | Source node ID |
| `target` | string | yes | Target node ID |
| `kind` | string | yes | See edge-kind table below |
| `meta` | object | yes | Kind-specific metadata |

### Edge kinds

| Kind | Source → Target | Description |
|---|---|---|
| `imports` | any → any | TypeScript import / C# `using` |
| `injects` | service/component → service | DI constructor injection |
| `calls` | method → method | Direct call edge (intra-project) |
| `http-call` | UI node → API action/endpoint | Cross-stack HTTP call (from cross-linker) |
| `route-handler` | route → component | Angular route → component mapping |
| `extends` | class → base class | Inheritance |
| `implements` | class → interface | Interface implementation |
| `declares` | module → component/pipe/directive | NgModule declarations |
| `registers` | — → service | DI registration |
| `uses-dto` | action → DTO | Action parameter or return type |
| `returns` | method → type | Return type edge |
| `routes-to` | route → route | Child/lazy route |
| `renders` | component → component | Template child component usage |
| `binds` | component → model | Template data binding |

---

## Finding

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique ID for this finding |
| `ruleId` | string | yes | Rule identifier (e.g. `dead-code/unused-service`) |
| `severity` | string | yes | `"info"`, `"warn"`, or `"error"` |
| `category` | string | yes | `"dead-code"`, `"layering"`, `"scss"`, `"security"`, `"perf"`, `"architecture"` |
| `title` | string | yes | Human-readable title |
| `detail` | string | yes | Detailed explanation |
| `nodeId` | string | no | If anchored to a specific node |
| `filePath` | string | no | File path for the finding |
| `line` | int | no | Line number |

---

## Stable ID scheme

Node IDs follow the pattern:

```
{side}:{kind}:{fqName}@{project}
```

This ensures the same logical node gets the same ID across re-scans, which
makes diff and progression tracking cheap (set-based symmetric difference).

Example:
```
ui:ng-component:src/app/orders/order-list.component.ts#OrderListComponent@sample-ui
api:dotnet-action:SampleApi.Controllers.OrdersController.List@sample-api
```

Edge IDs follow the pattern:

```
{kind}|{sourceId}->{targetId}
```

With optional suffix for disambiguation:

```
{kind}|{sourceId}->{targetId}|{suffix}
```
