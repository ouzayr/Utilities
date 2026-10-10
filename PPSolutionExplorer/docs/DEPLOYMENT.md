# PP Solution Explorer – Deployment Guide

Step-by-step instructions to build, install, run, operate and upgrade PP Solution Explorer.
The tool is designed to run **on the user's own machine** (or a locked-down single-user VM), bound to `127.0.0.1`.

Contents
1. Deployment options
2. Prerequisites
3. Option A – Developer setup
4. Option B – Windows workstation (recommended for consultants)
5. Option C – Linux workstation / VM (systemd)
6. Option D – Docker Compose (Linux)
7. Configuration reference
8. Enabling the AI layer (after the model is chosen)
9. Verification checklist
10. Operations: backup, restore, upgrade, uninstall
11. Troubleshooting
12. Security checklist

---

## 1. Deployment options

| Option | Use when | Components |
|---|---|---|
| A. Developer | Changing code | `dotnet run` + `ng serve` + local/Docker PostgreSQL |
| B. Windows | Consultant laptop | Self-contained `win-x64` publish + PostgreSQL for Windows (+ optional llama.cpp) |
| C. Linux | Workstation or single-user VM | Self-contained `linux-x64` publish + systemd units |
| D. Docker | Linux host with Docker | `deploy/docker-compose.yml` (DB, app, optional llama-server) using host networking |

All options: one process serves both API and UI on `http://127.0.0.1:5080`.

## 2. Prerequisites

| Component | Version | Needed for | Notes |
|---|---|---|---|
| .NET SDK | 9.0.x | building | Runtime not needed on target: publish is self-contained. `global.json` pins 9.0 with `latestFeature` roll-forward. |
| Node.js | 22 LTS (npm 10) | building the UI | Not needed on target. |
| PostgreSQL | 16 (14+ works) | runtime | Local instance. Only one database and one login role required. |
| Chrome/Chromium | any recent | frontend tests only | Set `CHROME_BIN` if not on PATH. |
| llama.cpp `llama-server` | recent release | AI only | See §8. |
| Hardware | 4 cores / 8 GB RAM minimum | runtime without AI | AI: see §8.1. |
| Disk | ~300 MB app + DB growth | | DB size ≈ 2–5× the size of imported flow JSON. |

Ports (all loopback): app 5080, PostgreSQL 5432, llama-server 8080.

## 3. Option A – Developer setup

```bash
git clone <repo> && cd Utilities/PPSolutionExplorer

# Database: Docker…
cp deploy/.env.example deploy/.env      # set PPSE_DB_PASSWORD=ppse (matches appsettings.Development.json)
docker compose -f deploy/docker-compose.yml up -d db
# …or an existing PostgreSQL:
#   psql -U postgres -c "CREATE ROLE ppse LOGIN PASSWORD 'ppse';"
#   psql -U postgres -c "CREATE DATABASE ppse OWNER ppse;"

# Backend (Development environment → appsettings.Development.json)
export ASPNETCORE_ENVIRONMENT=Development          # PowerShell: $env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --project src/Api                       # migrates DB, listens on http://127.0.0.1:5080

# Frontend (second terminal)
cd web && npm ci && npx ng serve                   # http://localhost:4200, proxies /api to :5080

# Tests
dotnet test --filter "Category!=LlamaLive"
PPSE_TEST_CONNECTION="Host=127.0.0.1;Database=ppse_test;Username=ppse;Password=ppse" dotnet test --filter "Category!=LlamaLive"
cd web && npx ng test --watch=false
```

The Postgres integration tests **drop and recreate** the database named in `PPSE_TEST_CONNECTION`; never point them at a real database. The `ppse` role needs `CREATEDB` for that (`ALTER ROLE ppse CREATEDB;`).

EF tooling (restored from `.config/dotnet-tools.json`):
```bash
dotnet tool restore
dotnet ef migrations add <Name> -p src/Persistence -s src/Persistence -o Migrations
dotnet ef migrations script -p src/Persistence -s src/Persistence -o migrate.sql --idempotent   # for DBAs
```

## 4. Option B – Windows workstation

### 4.1 Build (on a build machine with SDK + Node)
```powershell
cd Utilities\PPSolutionExplorer
.\scripts\publish.ps1 -Rid win-x64
# Output: .\publish\win-x64\  (PPSolutionExplorer.Api.exe, wwwroot\, prompts\, appsettings.json)
```
The script runs `npm ci`, the production Angular build, the test suite (excluding live-model tests) and a self-contained publish. It stops on the first failure.

### 4.2 Install PostgreSQL
1. Install PostgreSQL 16 for Windows (EDB installer). Keep port 5432. In `postgresql.conf` ensure `listen_addresses = 'localhost'`.
2. In *SQL Shell (psql)* as `postgres`:
   ```sql
   CREATE ROLE ppse LOGIN PASSWORD '<strong password>';
   CREATE DATABASE ppse OWNER ppse;
   ```

### 4.3 Install the application
1. Copy `publish\win-x64` to `C:\Program Files\PPSolutionExplorer` (or `%LOCALAPPDATA%\PPSolutionExplorer` without admin rights).
2. Create `appsettings.Local.json` next to the exe (git-ignored, overrides `appsettings.json`):
   ```json
   {
     "ConnectionStrings": {
       "Explorer": "Host=127.0.0.1;Port=5432;Database=ppse;Username=ppse;Password=<strong password>"
     }
   }
   ```
   Restrict the file to the user: `icacls appsettings.Local.json /inheritance:r /grant:r "%USERNAME%:R"`.
3. First run (applies migrations): double-click `PPSolutionExplorer.Api.exe` or run it from a terminal. Open http://127.0.0.1:5080.

### 4.4 Run as a Windows service (optional)
The app supports the Windows service lifetime and sets its content root to the install folder automatically.
```powershell
# Elevated PowerShell
New-Service -Name PPSolutionExplorer -BinaryPathName '"C:\Program Files\PPSolutionExplorer\PPSolutionExplorer.Api.exe"' `
  -DisplayName "PP Solution Explorer" -StartupType Automatic
Start-Service PPSolutionExplorer
Get-Service PPSolutionExplorer
```
The service account must be able to read `appsettings.Local.json` (grant it explicitly if you restricted the file to your user). Logs go to the Windows Event Log (Application, source `PPSolutionExplorer`). Remove with `Stop-Service PPSolutionExplorer; sc.exe delete PPSolutionExplorer`.

## 5. Option C – Linux workstation / VM (systemd)

```bash
# 5.1 Build
scripts/publish.sh linux-x64            # → publish/linux-x64

# 5.2 PostgreSQL (Debian/Ubuntu)
sudo apt install postgresql-16
sudo -u postgres psql -c "CREATE ROLE ppse LOGIN PASSWORD '<strong password>';"
sudo -u postgres psql -c "CREATE DATABASE ppse OWNER ppse;"
# Default listen_addresses is 'localhost' – keep it.

# 5.3 Install app
sudo useradd --system --home /opt/ppse --shell /usr/sbin/nologin ppse
sudo mkdir -p /opt/ppse /etc/ppse
sudo cp -r publish/linux-x64/* /opt/ppse/
sudo chown -R ppse:ppse /opt/ppse
sudo tee /etc/ppse/ppse.env >/dev/null <<'EOF'
ConnectionStrings__Explorer=Host=127.0.0.1;Port=5432;Database=ppse;Username=ppse;Password=<strong password>
Ai__Enabled=false
EOF
sudo chmod 600 /etc/ppse/ppse.env

# 5.4 Service
sudo cp deploy/ppse.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ppse
systemctl status ppse
journalctl -u ppse -f
```
The unit runs as `ppse` with `ProtectSystem=strict`, `ProtectHome`, `NoNewPrivileges` and only `/opt/ppse` writable.

## 6. Option D – Docker Compose (Linux)

Host networking is used so the app reaches PostgreSQL and llama-server on `127.0.0.1` (the AI client refuses non-loopback hosts by design). Host networking only works on Linux; on Windows/macOS use Docker for the database only and run the app natively (Option B/A).

```bash
cd Utilities/PPSolutionExplorer
cp deploy/.env.example deploy/.env       # set PPSE_DB_PASSWORD
chmod 600 deploy/.env
docker compose -f deploy/docker-compose.yml up -d --build      # db + app
docker compose -f deploy/docker-compose.yml logs -f app
```
- DB data persists in the `ppse-db` volume. Port published as `127.0.0.1:5432` only.
- With AI (after §8): put the `.gguf` in `deploy/models/`, set `PPSE_MODEL_FILE`, `PPSE_AI_ENABLED=true`, `PPSE_GPU_LAYERS` (0 for CPU; GPU needs the CUDA image `ghcr.io/ggml-org/llama.cpp:server-cuda` and `--gpus all`), then
  `docker compose -f deploy/docker-compose.yml --profile ai up -d`.
- Pin image tags (e.g. a specific llama.cpp build) in production instead of floating tags.

Note: the Docker image and the `ai` profile were written but not executed in the original build environment; build once and run the §9 checklist before rolling out.

## 7. Configuration reference

Sources, later wins: `appsettings.json` → `appsettings.{Environment}.json` → `appsettings.Local.json` → environment variables (`Section__Key`) → command line (`--Section:Key=value`).

| Key | Default | Description |
|---|---|---|
| `Urls` | `http://127.0.0.1:5080` | Listen address. Keep loopback. Change the port here if 5080 is taken. |
| `AllowedHosts` | `localhost;127.0.0.1` | Host header filter. |
| `ConnectionStrings:Explorer` | dev string | Npgsql connection string. Required. |
| `Database:MigrateOnStartup` | `true` | Set `false` if a DBA applies `migrate.sql` instead. |
| `Upload:MaxBytes` | `209715200` | Max upload (bytes). |
| `Ai:Enabled` | `false` | Master switch. Off = no HTTP client is created. |
| `Ai:BaseUrl` | `http://127.0.0.1:8080` | Must be loopback, else startup fails. |
| `Ai:Model` | `""` | Name recorded on outputs and sent to the server. Empty = first id from `/v1/models`. |
| `Ai:ContextSize` | `32768` | Must equal `llama-server -c`. |
| `Ai:ParallelSlots` | `2` | Must equal `--parallel`. Also the number of AI worker threads. |
| `Ai:TimeoutSeconds` | `300` | Per request. Increase for CPU inference. |
| `Ai:Temperature` | `0.1` | Clamped to 0–0.2 for structured output. |
| `Ai:MaxOutputTokens` | `1024` | Default reserve; prompts may override. |
| `Ai:PromptsPath` | `prompts` | Folder of `*.prompt.json` (shipped next to the binaries). |
| `Ai:TagVocabulary` | 16 tags | Fixed vocabulary for tag suggestions. |
| `Ai:Redaction:EnvironmentVariableValues` / `Secrets` / `Emails` / `Guids` / `TenantUrls` | `true` | What is masked before prompting. |
| `Ai:Redaction:ExtraPatterns` | `[]` | Extra regexes masked as `[REDACTED]` (e.g. customer codes). |
| `Logging:LogLevel:*` | Information/Warning | Standard ASP.NET Core logging (console; journald under systemd). |

## 8. Enabling the AI layer (after the model is chosen)

The model is intentionally not fixed. Everything below is model-agnostic.

### 8.1 Model selection criteria (from `CLAUDE.md`)
- Instruction-tuned **GGUF**, **7B+** parameters, **16k+ usable context** per slot, quantisation **Q4_K_M or better**.
- Must follow JSON schemas reliably (llama.cpp grammar-constrains output, but quality still varies).
- Licence must allow your commercial use.
- Sizing guide (Q4_K_M, approximate): 7–8B ≈ 5 GB weights; 14B ≈ 9 GB; 32B ≈ 20 GB. Add KV cache for 32k total context (several GB depending on the model). GPU with enough VRAM for `-ngl 99` is strongly recommended; CPU-only works but expect minutes per flow summary.

Evaluate 2–3 candidates on a few real (sanitised) flows: run `flow-summary` and `nl-search`, check accuracy and failure rate (`ai_status = failed`), then decide.

### 8.2 Install and run llama-server
1. Download a release build of llama.cpp for your OS/GPU (or build from source) and the chosen `.gguf`.
2. Start it on loopback with the context and slots the app expects:
   ```bash
   llama-server -m /path/model.gguf -c 32768 -ngl 99 --host 127.0.0.1 --port 8080 --parallel 2
   ```
   `-ngl 99` offloads all layers to GPU; use `-ngl 0` for CPU. Never use `--host 0.0.0.0`.
3. Check: `curl http://127.0.0.1:8080/health` → `{"status":"ok"}`.
4. Linux service: edit the model path in `deploy/llama-server.service`, copy to `/etc/systemd/system/`, `systemctl enable --now llama-server`. Windows: Task Scheduler "At log on" or NSSM, same as §4.4.

### 8.3 Turn it on in the app
```json
// appsettings.Local.json (or env vars Ai__Enabled=true, Ai__Model=...)
{ "Ai": { "Enabled": true, "Model": "<model name as you want it recorded>", "ContextSize": 32768, "ParallelSlots": 2 } }
```
Restart the app. The header pill shows `AI: <model>`; `GET /api/ai/status` shows `reachable: true`.

### 8.4 Validate
```bash
PPSE_LLAMA_URL=http://127.0.0.1:8080 dotnet test --filter "Category=LlamaLive"
```
Then in the UI: open a flow → *Summarise flow*, a step → *Describe step*, Search → *Ask in plain English*.

### 8.5 Changing model or prompts later
- Changing `Ai:Model` automatically invalidates the cache (model is part of the key). Old outputs stay, labelled with the old model.
- Editing a prompt requires bumping its `version` in `prompts/<name>.prompt.json`; redeploy the `prompts` folder.

## 9. Verification checklist (after any install or upgrade)

| # | Check | Expected |
|---|---|---|
| 1 | `curl http://127.0.0.1:5080/api/health` | `{"status":"ok"}` |
| 2 | Open http://127.0.0.1:5080 | Imports page, header shows `AI: off` (or model) |
| 3 | Upload the sample (zip the contents of `tests/fixtures/solutions/SampleSolution`) | Import "PPSE Sample", 1 warning (legacy business rule), 2 unresolved |
| 4 | Open *Account Sync* | Graph with Try/Catch/Switch, red dashed Try→Catch edge |
| 5 | Trace (defaults) | 8 paths, 8 returned |
| 6 | Impact of table `contact` | List_contacts (Reads), Update_contact (Writes), columns, loop steps |
| 7 | Docs (HTML) | Downloaded file with steps tree, data access, quality findings |
| 8 | From another machine: `curl http://<host-ip>:5080` | Connection refused (loopback only) |
| 9 | AI on: *Summarise flow* | Job succeeds; output framed "AI-generated · model · prompt v1 · time" |

## 10. Operations

### Backup / restore
```bash
pg_dump -h 127.0.0.1 -U ppse -Fc ppse > ppse_$(date +%F).dump        # backup
pg_restore -h 127.0.0.1 -U ppse -d ppse --clean ppse_YYYY-MM-DD.dump # restore
# Docker: docker compose -f deploy/docker-compose.yml exec db pg_dump -U ppse -Fc ppse > ppse.dump
```
What matters most are `tags`, `notes` and `ai_outputs` (imports can be re-created from the original zips). Backups contain customer data – store them encrypted.

### Upgrade
1. Back up the DB.
2. Build the new version (`scripts/publish.*`).
3. Stop the service, replace the install folder **except** `appsettings.Local.json`, start it. Migrations apply on start (or run the idempotent `migrate.sql` first if `MigrateOnStartup=false`).
4. Run the §9 checklist.
Rollback: restore the previous folder and the DB backup (migrations are forward-only).

### Housekeeping
- Delete old imports from the UI (tags/notes are kept, keyed by node ID).
- Remove failed AI rows when needed: `DELETE FROM ai_outputs WHERE ai_status = 'failed' AND created_at < now() - interval '30 days';`

### Uninstall
Stop/remove the service, delete the install folder, `DROP DATABASE ppse; DROP ROLE ppse;`, remove `/etc/ppse` (Linux) and the llama.cpp model files.

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App exits: `ConnectionStrings:Explorer is not configured` | Add the connection string (§4.3 / §5.3). |
| `password authentication failed for user "ppse"` | Wrong password or `pg_hba.conf` method; use `scram-sha-256` for `127.0.0.1/32`. |
| `relation "__EFMigrationsHistory" does not exist` logged once on first start | Normal; the migration then applies. |
| Port 5080 in use | Set `Urls=http://127.0.0.1:<port>`. In dev also update `web/proxy.conf.json`. |
| UI loads blank in production | `wwwroot` missing: build with `npx ng build` (outputs to `src/Api/wwwroot`) before `dotnet publish`, or use the publish script. |
| Upload: `Archive is neither a solution export…` | Not a solution/package zip. Export the solution from make.powerapps.com → *Solutions → Export*. |
| Upload 413 | File larger than `Upload:MaxBytes`. |
| Many `unresolved` items | Expected for dynamic expressions; inspect the raw expression in the node panel. Never auto-resolved. |
| Table shows as `contacts` and `contact` separately | Table metadata not in the solution, so entity-set name could not be mapped. Add the table to the solution or accept both. |
| Startup error: `Ai:BaseUrl … is not a loopback address` | By design. Run llama-server locally on 127.0.0.1. |
| AI pill `unreachable` | llama-server not running / wrong port: `curl http://127.0.0.1:8080/health`. |
| AI jobs fail with timeout | CPU inference is slow: increase `Ai:TimeoutSeconds`, use a smaller model or GPU offload. |
| AI jobs fail with "Invalid structured output" | Model weak at JSON; try a stronger model, or check llama.cpp version supports `response_format.json_schema`. |
| Model answers truncated / context errors | `Ai:ContextSize`/`ParallelSlots` don't match `-c`/`--parallel`. |
| Jobs stuck "running" after a crash | Marked failed automatically on next start; re-run them. |
| `ng test` cannot start Chrome | Set `CHROME_BIN` to a Chrome/Chromium binary. |

## 12. Security checklist

- [ ] App, PostgreSQL and llama-server bound to `127.0.0.1` only (verify with `netstat -an` / `ss -ltn`).
- [ ] `appsettings.Local.json` / `/etc/ppse/ppse.env` / `deploy/.env` readable only by the service user; never committed.
- [ ] Strong, unique DB password; `ppse` role owns only the `ppse` database (`CREATEDB` only on dev machines).
- [ ] Full-disk encryption on the machine (the DB holds customer flow definitions).
- [ ] Backups encrypted and retained per client agreements.
- [ ] Redaction options left on unless a client explicitly agrees otherwise.
- [ ] Docs exported without env variable values unless needed.
- [ ] Only sanitised flows in `tests/fixtures` (no real IDs, URLs, names, tenant data).
- [ ] Do not expose the app on a network; it has no authentication. If shared access is ever required, add authentication and TLS first (reverse proxy with SSO) and revisit the local-only principle.
