# Contributing

## Project structure

```
code-cartographer/
├── apps/
│   ├── api/                .NET 8 Web API (EF Core + Npgsql)
│   ├── scanner-angular/    Node 20 CLI (ts-morph + @angular/compiler)
│   ├── scanner-dotnet/     .NET 8 CLI (Roslyn / Microsoft.CodeAnalysis)
│   └── web/                Angular 17 SPA (Cytoscape.js for graph)
├── samples/
│   ├── sample-api/         Tiny .NET 8 API for testing the scanner
│   └── sample-ui/          Tiny Angular 17 app for testing the scanner
├── docs/                   Architecture, API, data model, etc.
├── docker-compose.yml
├── cc-scan-config.example.json
└── README.md
```

## Dev setup

### Prerequisites

- .NET SDK 8.0+
- Node.js 20+
- PostgreSQL 16+ (or Docker)

### Quick start

```bash
# 1. Start the database
docker run --rm -d --name cc-db \
  -e POSTGRES_USER=cc -e POSTGRES_PASSWORD=cc -e POSTGRES_DB=codecartographer \
  -p 15432:5432 postgres:16

# 2. Start the API
cd apps/api && dotnet restore && dotnet run

# 3. Start the web UI (in another terminal)
cd apps/web && npm install && npm start
```

See `docs/DEPLOYMENT.md` for the full guide.

## Coding conventions

### .NET (API + scanner-dotnet)

- Target: .NET 8, C# 12
- Nullable reference types enabled
- Minimal API style (no controllers in the API project — endpoints are static
  methods grouped by feature)
- Use `sealed` on classes by default
- `record` for DTOs and request/response types
- JSON property names: camelCase (`[JsonPropertyName]`)
- EF Core: code-first, no migrations yet (uses `EnsureCreated`)

### TypeScript (web + scanner-angular)

- Angular 17 standalone components (no NgModules)
- Signal-based state where possible
- Single-file components (template + styles inline in the `.ts` file)
- Strict TypeScript (`strict: true`)
- Imports: `node:` prefix for Node.js built-ins

### General

- No external API calls at runtime (`CC_OFFLINE=true`)
- Never write back to user repos
- Never execute user code
- No secrets in code (PATs are encrypted at rest)

## Adding an API endpoint

1. Create `apps/api/Endpoints/MyFeatureEndpoints.cs`
2. Add a static `Map(WebApplication app)` method
3. Call it from `Program.cs`
4. Update `docs/API.md` with the new endpoint(s)

## Adding a scanner feature

1. Implement extraction in the appropriate scanner (`scanner-angular` or
   `scanner-dotnet`)
2. Emit nodes/edges using the stable ID scheme from `docs/GRAPH_SCHEMA.md`
3. Test against the `samples/` projects
4. If you add a new node kind or edge kind, update `docs/GRAPH_SCHEMA.md`

## Adding a web page

1. Create `apps/web/src/app/pages/my-page.component.ts` as a standalone
   component
2. Add a route in `app.routes.ts` with lazy loading
3. Add the nav link in `app.component.ts`
4. Use the `ApiService` for API calls

## Commit messages

Use conventional commit style:

```
feat(api): add bookmark CRUD endpoints
fix(scanner-angular): handle barrel re-exports in HTTP call URLs
docs: update API reference for new endpoints
```

## Pull requests

- One feature/fix per PR
- Update relevant docs if you change APIs, schemas, or configuration
- Run a scan against `samples/` to verify scanner changes don't regress
