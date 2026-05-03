# API Reference

Base URL: `http://localhost:8080`

Swagger UI is available at `/swagger` when the API is running.

---

## Scans

### `POST /api/scans`

Create a new scan (status = `running`).

**Request body:**
```json
{
  "repoIds": ["<uuid>", ...],   // optional — repos to associate with this scan
  "label": "my-scan"            // optional — human-readable label
}
```

**Response:** `200 OK`
```json
{
  "scanId": "<uuid>"
}
```

### `GET /api/scans`

List scans, most recent first (max 200).

**Response:** `200 OK`
```json
[
  {
    "id": "<uuid>",
    "status": "running" | "succeeded" | "failed" | "imported",
    "startedAt": "2026-05-01T12:00:00Z",
    "finishedAt": "2026-05-01T12:01:00Z",
    "label": "my-scan",
    "summary": { "nodes": 150, "edges": 230, "findings": 12, "crossLinks": 8 },
    "error": null
  }
]
```

### `GET /api/scans/{id}`

Get scan details with counts.

**Response:** `200 OK`
```json
{
  "scan": { ... },
  "nodeCount": 150,
  "edgeCount": 230,
  "findingCount": 12
}
```

### `DELETE /api/scans/{id}`

Delete a scan and all its nodes, edges, and findings.

**Response:** `204 No Content`

### `GET /api/scans/{id}/findings`

List findings for a scan.

**Query params:**
- `severity` — filter by `info`, `warn`, or `error`
- `category` — filter by `dead-code`, `layering`, `scss`, `security`, `perf`, `architecture`

**Response:** `200 OK`
```json
[
  {
    "id": "...",
    "ruleId": "dead-code/unused-service",
    "severity": "warn",
    "category": "dead-code",
    "title": "Unused service: FooService",
    "detail": "FooService is never injected by any component or service.",
    "nodeId": "ui:ng-service:...",
    "filePath": "src/app/services/foo.service.ts",
    "line": 10
  }
]
```

### `GET /api/scans/{id}/projects`

List projects within a scan with node counts.

**Response:** `200 OK`
```json
[
  { "side": "ui", "project": "sample-ui", "count": 45 },
  { "side": "api", "project": "sample-api", "count": 105 }
]
```

---

## Graph

### `POST /api/graph/ingest`

Ingest a `graph.json` payload from a scanner. Deduplicates nodes/edges by ID. Runs the cross-linker after ingest.

**Query params:**
- `scanId` — existing scan UUID to merge into (if omitted, creates a new scan)
- `finalize` — set to `true` to mark the scan as `succeeded`

**Request body:** A `graph.json` payload (see `docs/GRAPH_SCHEMA.md`).

**Response:** `200 OK`
```json
{
  "scanId": "<uuid>",
  "nodesIngested": 85,
  "edgesIngested": 120,
  "findingsIngested": 5,
  "crossLinks": 3
}
```

### `GET /api/graph/{scanId}`

Retrieve the full graph for a scan.

**Query params:**
- `side` — filter nodes by `ui` or `api`
- `kind` — filter nodes by kind (e.g. `ng-component`, `dotnet-action`)
- `project` — filter nodes by project key

**Response:** `200 OK`
```json
{
  "scanId": "<uuid>",
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

---

## Flow & Impact

### `GET /api/flows/from`

Traverse the graph from a starting node using BFS.

**Query params (required):**
- `scanId` — scan UUID
- `nodeId` — starting node ID

**Query params (optional):**
- `direction` — `downstream` (default follows outgoing edges), `upstream` (follows incoming edges), or `both`
- `maxDepth` — max BFS depth (default: 6)

**Response:** `200 OK`
```json
{
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

### `GET /api/impact`

Find all upstream consumers of a node (i.e. "who depends on me?").

**Query params (required):**
- `scanId` — scan UUID
- `nodeId` — node to check

**Response:** `200 OK`
```json
{
  "root": "<nodeId>",
  "impactedCount": 12,
  "summary": [
    { "side": "ui", "kind": "ng-component", "count": 5 },
    { "side": "api", "kind": "dotnet-service", "count": 3 }
  ],
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

---

## Diff

### `GET /api/diff/{leftScanId}/{rightScanId}`

Compare two scans by symmetric difference on node/edge/finding IDs.

**Response:** `200 OK`
```json
{
  "leftScan": "<uuid>",
  "rightScan": "<uuid>",
  "addedNodes": [ ... ],
  "removedNodes": [ ... ],
  "addedEdges": [ ... ],
  "removedEdges": [ ... ],
  "newFindings": [ ... ],
  "fixedFindings": [ ... ],
  "stableFindings": [ ... ]
}
```

---

## Dashboard

### `GET /api/dashboard/{scanId}`

Aggregated KPIs and breakdowns for a scan.

**Response:** `200 OK`
```json
{
  "totals": { "nodes": 150, "edges": 230, "findings": 12 },
  "kpis": {
    "apiActions": 15,
    "orphanEndpoints": 3,
    "uiComponents": 22,
    "uiServices": 8,
    "crossLinks": 6
  },
  "byKind": [ { "kind": "ng-component", "count": 22 }, ... ],
  "byProject": [ { "project": "sample-ui", "count": 45 }, ... ],
  "bySeverity": { "warn": 8, "error": 2, "info": 2 },
  "byCategory": { "dead-code": 5, "layering": 3, "security": 2, "scss": 2 }
}
```

### `GET /api/dashboard/trends`

Node/edge/finding counts over the last N scans (for sparkline charts).

**Query params:**
- `limit` — number of scans to include (default: 20)

**Response:** `200 OK`
```json
[
  { "scanId": "<uuid>", "startedAt": "...", "label": "...", "nodes": 150, "edges": 230, "findings": 12 }
]
```

---

## Repositories

### `GET /api/repos`

List all registered repositories.

**Response:** `200 OK`
```json
[
  {
    "id": "<uuid>",
    "name": "my-angular-app",
    "side": "ui",
    "sourceKind": "local",
    "location": "C:\\Projects\\my-angular-app",
    "includeGlobs": null,
    "excludeGlobs": null,
    "createdAt": "2026-05-01T10:00:00Z",
    "updatedAt": "2026-05-01T10:00:00Z"
  }
]
```

### `POST /api/repos`

Add a new repository.

**Request body:**
```json
{
  "name": "my-angular-app",
  "side": "ui",                   // "ui" | "api" | "both"
  "sourceKind": "local",          // "local" | "github" | "azuredevops"
  "location": "C:\\Projects\\my-angular-app",
  "includeGlobs": null,           // optional
  "excludeGlobs": null            // optional
}
```

**Response:** `200 OK` — the created repo object.

### `DELETE /api/repos/{id}`

Remove a repository.

**Response:** `204 No Content`

---

## File System (development)

### `GET /api/fs/browse`

Browse the host file system (for the folder picker in the UI).

**Query params:**
- `path` — directory to list. If omitted, returns available drive roots.

**Response:** `200 OK`
```json
{
  "currentPath": "C:\\Projects",
  "entries": [
    { "name": "my-app", "path": "C:\\Projects\\my-app", "type": "directory", "side": null }
  ],
  "hints": {
    "isGitRepo": true,
    "hasAngularJson": true,
    "hasSln": false,
    "hasCsproj": false,
    "hasPackageJson": true
  }
}
```

---

## Import / Export

### `POST /api/scans/import`

Import a previously exported scan JSON. Creates a new scan with status `imported`.

**Request body:** A full scan JSON (same shape as the `/reports/{id}/export?format=json` output).

**Response:** `200 OK`
```json
{
  "scanId": "<uuid>"
}
```

### `GET /api/reports/{scanId}/export`

Export a scan as a report.

**Query params:**
- `format` — `json`, `md` (Markdown), or `html`

**Response:** File download with appropriate content type.
