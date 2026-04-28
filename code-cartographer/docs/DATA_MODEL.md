# Data Model

The core unit is a **scan**: an immutable snapshot of a set of repos at a
moment in time. A scan owns nodes, edges, findings, and metrics.

## SQL schema (Postgres)

```sql
CREATE TABLE repos (
    id              uuid PRIMARY KEY,
    name            text NOT NULL,
    side            text NOT NULL CHECK (side IN ('ui', 'api', 'both')),
    source_kind     text NOT NULL CHECK (source_kind IN ('local', 'github', 'azuredevops')),
    location        text NOT NULL,        -- absolute path or git URL
    pat_encrypted   bytea,                -- nullable
    include_globs   text,
    exclude_globs   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scans (
    id              uuid PRIMARY KEY,
    started_at      timestamptz NOT NULL,
    finished_at     timestamptz,
    status          text NOT NULL,        -- 'running' | 'succeeded' | 'failed'
    repo_ids        uuid[] NOT NULL,
    summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
    error           text,
    label           text                  -- optional user label for the snapshot
);
CREATE INDEX scans_started_at_idx ON scans (started_at DESC);

CREATE TABLE nodes (
    scan_id         uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    node_id         text NOT NULL,
    kind            text NOT NULL,
    side            text NOT NULL,
    project         text NOT NULL,
    name            text NOT NULL,
    fq_name         text NOT NULL,
    file_path       text NOT NULL,
    line            int,
    meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics         jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (scan_id, node_id)
);
CREATE INDEX nodes_kind_idx     ON nodes (scan_id, kind);
CREATE INDEX nodes_project_idx  ON nodes (scan_id, project);
CREATE INDEX nodes_fqname_idx   ON nodes (scan_id, fq_name);

CREATE TABLE edges (
    scan_id         uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    edge_id         text NOT NULL,
    source_id       text NOT NULL,
    target_id       text NOT NULL,
    kind            text NOT NULL,
    meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (scan_id, edge_id)
);
CREATE INDEX edges_source_idx ON edges (scan_id, source_id);
CREATE INDEX edges_target_idx ON edges (scan_id, target_id);
CREATE INDEX edges_kind_idx   ON edges (scan_id, kind);

CREATE TABLE findings (
    scan_id         uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    finding_id      text NOT NULL,
    rule_id         text NOT NULL,
    severity        text NOT NULL,        -- 'info' | 'warn' | 'error'
    category        text NOT NULL,        -- 'dead-code' | 'layering' | 'scss' | 'security' | 'perf' | 'architecture'
    title           text NOT NULL,
    detail          text NOT NULL,
    node_id         text,                 -- optional: anchored to a node
    file_path       text,
    line            int,
    PRIMARY KEY (scan_id, finding_id)
);
CREATE INDEX findings_rule_idx     ON findings (scan_id, rule_id);
CREATE INDEX findings_severity_idx ON findings (scan_id, severity);
CREATE INDEX findings_category_idx ON findings (scan_id, category);

-- Coverage import (MVP-4)
CREATE TABLE coverage (
    scan_id   uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    line      int  NOT NULL,
    hits      int  NOT NULL,
    PRIMARY KEY (scan_id, file_path, line)
);

-- Bookmarks (MVP-2)
CREATE TABLE bookmarks (
    id          uuid PRIMARY KEY,
    name        text NOT NULL,
    config      jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
```

## graph.json (the scanner ↔ API contract)

```jsonc
{
  "schemaVersion": 1,
  "side": "ui",                 // or "api"
  "project": "sample-ui",
  "scannedAt": "2026-04-28T19:50:00Z",
  "nodes": [ /* GraphNode[] */ ],
  "edges": [ /* GraphEdge[] */ ],
  "metrics": {
    "filesScanned": 142,
    "msTaken": 873
  },
  "findings": [ /* Finding[] */ ]
}
```

## Stable node IDs

`{side}:{kind}:{fqName}@{project}` — chosen so that the same logical node has
the same id across re-scans, which makes diff and progression tracking cheap.

Example: `ui:component:src/app/orders/order-list.component.ts#OrderListComponent@sample-ui`
