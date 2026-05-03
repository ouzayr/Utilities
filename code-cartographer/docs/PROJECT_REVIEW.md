# Project Review — code-cartographer

_Review date: 2026-05-03_

---

## 1. Are all 4 apps needed?

**Yes — all four apps under `apps/` serve distinct, non-overlapping roles.**

| App | Role | Language | Could it be merged? |
|---|---|---|---|
| `api` | REST API + Postgres persistence + cross-linker + reporting | .NET 8 | No — it's the central hub |
| `web` | Angular 17 SPA for all visualisation / management | TypeScript | No — different runtime (browser) |
| `scanner-angular` | Static analyser for Angular/TS codebases (ts-morph) | Node 20 / TS | Merging into `api` would require Node in the .NET container — impractical |
| `scanner-dotnet` | Static analyser for .NET codebases (Roslyn) | .NET 8 | _Could_ share a project with `api`, but they have different package dependencies (Roslyn vs EF/Npgsql) and different deployment profiles (long-running server vs short-lived CLI). Keeping them separate is the right call. |

**Verdict:** The 4-app split is correct. It follows the "each process does one thing" principle and keeps Docker images lean.

### What about the `samples/` folder?

The `samples/sample-ui` and `samples/sample-api` are **validation fixtures** — tiny Angular and .NET projects used to test the scanners. They are referenced in `docker-compose.yml` and in the README. **Keep them** — they're essential for verifying scanner output.

---

## 2. Structural issues found

### 2.1 Missing foreign keys in the database

`ScanEndpoints.cs` line 56 has a comment:

> "children are CASCADE on the FK, but we don't have an FK declared, so wipe manually."

The `DATA_MODEL.md` declares `REFERENCES scans(id) ON DELETE CASCADE` in SQL, but the EF Core `OnModelCreating` in `AppDbContext.cs` never configures navigation properties or foreign keys. EF's `EnsureCreated()` will therefore create the tables **without** the FK constraints. This means:

- Deleting a scan requires manual `ExecuteDeleteAsync` on 3 child tables (current code does this, but it's fragile).
- There's no referential integrity enforced at the DB level.

**Recommendation:** Add `.HasOne<Scan>().WithMany().HasForeignKey(x => x.ScanId).OnDelete(DeleteBehavior.Cascade)` to `Node`, `Edge`, `Finding`, and `Coverage` in `OnModelCreating`. Then the manual delete code becomes unnecessary.

### 2.2 `EnsureCreated()` vs migrations

`Program.cs:53` uses `db.Database.EnsureCreated()`. This is fine for a dev tool, but it means schema changes after the initial creation are silently ignored — the DB won't gain new columns or tables. The comment acknowledges this ("add a real migrations history later").

**Recommendation (low priority):** When you next add a column or table, switch to `Migrate()` + proper EF migrations.

### 2.3 No `scripts/` directory despite PLAN.md referencing it

`PLAN.md` line 141 lists `scripts/` as a directory for "dev launchers (bash + powershell)". This directory doesn't exist.

**Recommendation:** Either create it with `start-api.ps1`, `start-web.ps1`, `scan.ps1` convenience scripts, or remove the reference from PLAN.md.

### 2.4 No test suite

There are zero unit tests across all 4 apps — no `*.spec.ts`, no `*.Tests.csproj`, no test runner configuration.

**Recommendation (medium priority):** At minimum, add tests for:
- `CrossLinker.RouteMatches()` — the core matching logic has edge cases (prefix stripping, wildcard segments)
- Scanner output validation against `samples/` (snapshot testing)
- API endpoints (integration tests with in-memory SQLite or Postgres testcontainer)

### 2.5 `DashboardEndpoints.trends` has an N+1 query

`DashboardEndpoints.cs:55-68` fetches the last N scans, then loops over each and runs 3 separate `COUNT` queries. For 20 scans that's 60 extra queries.

**Recommendation:** Replace with a single query using `GroupBy` or a subquery.

### 2.6 `FlowEngine` and `DiffEngine` load entire scan into memory

Both engines do `ToListAsync()` on all nodes and edges for a scan before processing. For small-to-medium projects this is fine, but for large monorepos (10k+ nodes) this could cause memory pressure.

**Recommendation (low priority, future):** Consider a SQL-based BFS (recursive CTE) for `FlowEngine` if performance becomes an issue.

### 2.7 Duplicate model definitions

The `GraphNode`, `GraphEdge`, `Finding` types are defined in three places:
1. `scanner-angular/src/types.ts` (TypeScript)
2. `scanner-dotnet/Models.cs` (C#)
3. `api/Db/Dtos.cs` (C#, slightly different property names)

This is expected given the different runtimes, but **changes to the graph schema require updating all three**. There's no shared schema file or contract test to catch drift.

**Recommendation:** Add a `docs/GRAPH_SCHEMA.md` that serves as the single source of truth (done below), and consider adding a CI step that validates `samples/` scanner output against a JSON Schema.

### 2.8 `Scan.RepoIds` declared as `uuid[]` but no FK enforcement

`Scan.RepoIds` is a Postgres `uuid[]` column. It stores which repos were included in the scan, but there's no check that those UUIDs actually exist in the `repos` table. A deleted repo leaves orphan references.

**Recommendation (low priority):** Either validate on insert or accept this as a known limitation (the IDs are just labels).

### 2.9 CORS origins are narrowly hardcoded

`Program.cs:38` allows `http://localhost:4200` and `http://localhost:{apiPort}`. If someone runs the web UI on a different port (e.g. via `ng serve --port 4300`), API calls will fail silently with CORS errors.

**Recommendation:** In development mode, consider allowing all localhost origins, or make the allowed origins configurable via `appsettings.json`.

### 2.10 `ReportRenderer` doesn't support PDF

`ARCHITECTURE.md:71` and `README.md:261` mention PDF export, but `ReportRenderer.cs:22` only supports `json`, `md`, and `html`. Requesting `pdf` throws an `InvalidOperationException`.

**Recommendation:** Either implement PDF (e.g. via `wkhtmltopdf` or a .NET PDF library) or remove PDF from the docs.

---

## 3. Documentation gaps

The following documentation is **missing** and would be expected for a project of this complexity:

| Document | Purpose | Status |
|---|---|---|
| `docs/API.md` | Full REST API reference (all endpoints, request/response shapes) | **Missing** — `ARCHITECTURE.md:61` references it but it doesn't exist |
| `docs/DEPLOYMENT.md` | Deployment guide (Docker, local Windows, environment variables) | **Missing** |
| `docs/SCANNER_INTERNALS.md` | How each scanner works internally, what node/edge kinds they emit | **Missing** |
| `docs/TROUBLESHOOTING.md` | Common issues and fixes | **Missing** (partially in README) |
| `docs/GRAPH_SCHEMA.md` | Canonical schema for `graph.json` with field descriptions | **Missing** |
| `docs/CONTRIBUTING.md` | Dev setup, coding standards, PR process | **Missing** |

These will be created as part of this PR.

---

## 4. Summary of recommendations by priority

| Priority | Item | Section |
|---|---|---|
| **High** | Add EF Core FK constraints for cascade deletes | 2.1 |
| **High** | Create missing docs (API.md, etc.) | 3 |
| **Medium** | Add basic test suite for CrossLinker + scanners | 2.4 |
| **Medium** | Fix N+1 in dashboard trends endpoint | 2.5 |
| **Medium** | Remove/fix PDF export reference in docs | 2.10 |
| **Low** | Switch to EF migrations when schema changes | 2.2 |
| **Low** | Create `scripts/` or remove from PLAN.md | 2.3 |
| **Low** | Make CORS origins configurable | 2.9 |
| **Low** | Validate `Scan.RepoIds` or document limitation | 2.8 |
| **Low** | Consider SQL-based BFS for large graphs | 2.6 |
