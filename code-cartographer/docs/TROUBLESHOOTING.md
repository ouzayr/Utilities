# Troubleshooting

Common issues and solutions for code-cartographer.

---

## Database

### `docker compose up` fails with `port 15432 already allocated`

Another Postgres instance (or a previous `cc-db` container) is using the port.

```bash
docker ps -a --filter "name=cc-db"    # check for leftover containers
docker rm -f cc-db                     # remove it
```

Or change the host port in `docker-compose.yml` (e.g. `25432:5432`) and update
`appsettings.json` / `CC_DB_CONNECTION` to match.

### API starts but crashes with `Npgsql.NpgsqlException: connection refused`

The database isn't running or the connection string is wrong.

1. Verify Postgres is running: `docker ps` or `pg_isready -h localhost -p 15432`
2. Check `appsettings.json` → `ConnectionStrings:DefaultConnection` matches your
   Postgres host/port/credentials.
3. If using Docker Compose, ensure the `db` container is healthy before starting
   the API: `docker compose up db -d && docker compose up api -d`.

### Schema changes aren't applied after updating the code

The API uses `EnsureCreated()` which only creates the schema on a fresh
database. If you add columns or tables:

```bash
# Option 1: drop and recreate (loses data)
docker compose down -v && docker compose up -d

# Option 2: manually ALTER TABLE in psql
docker exec -it cc-db psql -U cc -d codecartographer
```

---

## API

### CORS errors in the browser console

The API only allows `http://localhost:4200` and `http://localhost:8080` as
origins. If you're running the web UI on a different port:

1. Update `apps/api/Program.cs` line with `.WithOrigins(...)` to include your
   port, or
2. Run the web UI on the default port: `ng serve --port 4200`.

### Swagger UI shows no endpoints

Navigate to `http://localhost:8080/swagger`. If it's blank, the API might have
failed to start — check the terminal output for errors.

### `POST /api/graph/ingest` returns 400

The request body doesn't match the expected `graph.json` schema. Common issues:
- Missing required fields (`nodes`, `edges`, `findings` arrays)
- JSON parse error (malformed payload)
- Content-Type header must be `application/json`

---

## Web UI

### Page loads but shows no data

1. Open the browser dev tools (F12) → Network tab. Check if `/api/...` requests
   are returning 200.
2. If requests return 404: the proxy isn't working. Verify `proxy.conf.json`
   exists and `angular.json` references it in the serve options.
3. If requests return CORS errors: see "CORS errors" above.
4. If requests succeed but return empty arrays: no scans exist yet. Run the
   scanners first.

### `ng serve` fails with "proxy.conf.json not found"

Ensure `apps/web/proxy.conf.json` exists. It should contain:
```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```

### Folder browser shows "Loading..." forever

The API's `/api/fs/browse` endpoint might not be reachable.

1. Test directly: `curl http://localhost:8080/api/fs/browse`
2. On Windows, it should return a list of drive letters.
3. If the API isn't running, start it first.

---

## Scanners

### Angular scanner: `ts-morph` errors or no nodes found

1. Check that `--root` (or `root` in config) points to a directory with
   `tsconfig.json` or `tsconfig.app.json`.
2. If the project uses a workspace layout (e.g. `apps/my-app/`), point
   `--root` at the app directory, not the workspace root.
3. Run `npm install` in the target project first — `ts-morph` needs
   `node_modules` for type resolution.

### .NET scanner: MSBuildWorkspace failed

```
[cc-scan-dotnet] MSBuildWorkspace failed: ...
[cc-scan-dotnet] falling back to syntax-only scan
```

This means Roslyn couldn't load the `.sln`/`.csproj`. The scanner falls back
to syntax-only analysis (no semantic info, fewer edges).

Common causes:
- .NET SDK version mismatch. Run `dotnet --list-sdks` and ensure you have .NET 8.
- Missing NuGet packages. Run `dotnet restore` in the target project.
- `global.json` in the target project pins a different SDK version.

### Scanner config file not found

Both scanners search for `cc-scan-config.json` in:
1. Current working directory
2. One level up (`../`)
3. Two levels up (`../../`)

If using the config file approach, ensure you run the scanner from a directory
where the file is reachable.

### `--root is required` error

Either pass `--root /path/to/project` as a CLI flag, or set `"root"` in
`cc-scan-config.json`.

---

## Docker

### Scanner containers exit immediately

The scanners are one-shot processes — they scan, POST to the API, and exit.
This is expected. Check the logs:

```bash
docker compose --profile scan logs scanner-angular
docker compose --profile scan logs scanner-dotnet
```

### Containers can't reach each other

Inside Docker Compose, services use container names as hostnames:
- API → `http://api:8080`
- DB → `Host=db;Port=5432`

If running a scanner locally but the API in Docker, use `localhost:8080`
(since the API port is mapped to the host).

### Graph is empty after a scan

1. Check scanner logs for errors.
2. Verify `CC_API_BASE` / `--api-base` points to the correct API URL.
3. Confirm the scan ID is valid: `curl http://localhost:8080/api/scans`.
4. If nodes were ingested but the graph page is blank, make sure you selected
   the correct scan in the UI's scan picker.
