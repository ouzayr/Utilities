# CardForge — Setup & Deployment Guide

This guide covers every step to get CardForge running from scratch: database creation via EF Core migrations, API startup, and frontend startup. No helper scripts are used — every command is given explicitly.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository Layout](#2-repository-layout)
3. [Database Setup](#3-database-setup)
   - 3.1 Install the EF Core CLI tool
   - 3.2 Generate the initial migration
   - 3.3 Apply the migration (create tables)
4. [API Setup](#4-api-setup)
   - 4.1 Restore NuGet packages
   - 4.2 Configure connection string & JWT
   - 4.3 Run the API
5. [Frontend (Web) Setup](#5-frontend-web-setup)
   - 5.1 Install Node dependencies
   - 5.2 Configure the API URL
   - 5.3 Run the frontend
6. [Seed Demo Data](#6-seed-demo-data)
7. [Verify the Full Stack](#7-verify-the-full-stack)
8. [Production Deployment](#8-production-deployment)

---

## 1. Prerequisites

Install the following tools before you begin.

| Tool | Minimum Version | Notes |
|---|---|---|
| [.NET SDK](https://dotnet.microsoft.com/download) | 8.0 | Includes the `dotnet` CLI |
| [Node.js](https://nodejs.org) | 20 LTS | Includes `npm` |
| [SQL Server Express](https://www.microsoft.com/sql-server/sql-server-downloads) | 2019 | Installs LocalDB automatically |
| [SQL Server command-line tools](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility) | Any | Provides `sqlcmd` for seeding |

Verify the installations:

```cmd
dotnet --version
node --version
npm --version
sqlcmd -?
```

> **LocalDB**: SQL Server Express installs LocalDB alongside itself. The default development connection string (`Server=(localdb)\mssqllocaldb`) uses LocalDB and requires no extra configuration. LocalDB starts automatically on first connection.

---

## 2. Repository Layout

All CardForge work lives under the `cardforge/` folder in this repository.

```
cardforge/
├── docs/               ← documentation (you are here)
├── scripts/            ← seed.sql and dev helper scripts
└── apps/
    ├── api/            ← .NET 8 backend (four projects)
    │   ├── CardForge.Domain/           ← entities, enums (no dependencies)
    │   ├── CardForge.Application/      ← services, DTOs, interfaces, exceptions
    │   ├── CardForge.Infrastructure/   ← EF Core DbContext, JWT, payment stub
    │   └── CardForge.Api/              ← Minimal API endpoints, middleware, Program.cs
    └── web/            ← Next.js 14 TypeScript frontend
        └── src/
            ├── app/        ← App Router pages (auth / tenant / platform route groups)
            ├── components/ ← React components (editor, layout, subscription, ui)
            ├── lib/        ← API client, auth helpers, Fabric.js, export utilities
            └── types/      ← shared TypeScript interfaces
```

All commands below assume your working directory starts at the **repository root** (`Utilities/`). Adjust paths if you start elsewhere.

---

## 3. Database Setup

CardForge uses **Entity Framework Core** with the **SQL Server** provider. Migrations generate the full schema — no manual SQL is needed to create tables.

### 3.1 Install the EF Core CLI Tool

The `dotnet-ef` tool is a global dotnet tool. Install it once per machine:

```cmd
dotnet tool install --global dotnet-ef
```

If you already have it installed but it is out of date:

```cmd
dotnet tool update --global dotnet-ef
```

Verify the installation:

```cmd
dotnet ef --version
```

### 3.2 Generate the Initial Migration

The migration files are not committed to source control — you must generate them once before the first run. Navigate into the API solution folder first:

```cmd
cd cardforge\apps\api
```

Generate the migration:

```cmd
dotnet ef migrations add InitialCreate ^
    --project CardForge.Infrastructure ^
    --startup-project CardForge.Api
```

This creates migration files under `CardForge.Infrastructure/Persistence/Migrations/`. The command will output something like:

```
Build started...
Build succeeded.
Done. To undo this action, use 'ef migrations remove'
```

> **What gets created**: tables for `Tenants`, `Users`, `Templates`, `Cards`, `Subscriptions`, and `BillingDetails`, along with their unique indexes and foreign-key constraints.

### 3.3 Apply the Migration (Create Tables)

Apply the migration to the LocalDB instance to physically create the `CardForge` database and all tables:

```cmd
dotnet ef database update ^
    --project CardForge.Infrastructure ^
    --startup-project CardForge.Api
```

Expected output:

```
Build started...
Build succeeded.
Applying migration '20xxxxxxxxxxxxxx_InitialCreate'.
Done.
```

You can inspect the result with `sqlcmd`:

```cmd
sqlcmd -S "(localdb)\mssqllocaldb" -Q "SELECT name FROM sys.databases WHERE name = 'CardForge'"
```

> **Note**: In `Development` mode the API also runs `db.Database.Migrate()` automatically on startup (`Program.cs` lines 134–139). This is a safety net — it does **not** replace generating and applying migrations explicitly as shown above. Always run step 3.2 and 3.3 before the first API start.

---

## 4. API Setup

### 4.1 Restore NuGet Packages

From `cardforge/apps/api`:

```cmd
dotnet restore
```

This downloads all NuGet dependencies for all four projects.

### 4.2 Configure Connection String & JWT

The API reads configuration from layered `appsettings` files. The `Development` overrides are already set to sensible defaults:

**`cardforge/apps/api/CardForge.Api/appsettings.Development.json`** (no changes needed for local dev):

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=CardForge;Trusted_Connection=True;MultipleActiveResultSets=true"
  },
  "JwtSettings": {
    "Secret": "dev-only-jwt-secret-change-in-prod-32chars!",
    "Issuer": "cardforge-dev",
    "Audience": "cardforge-users",
    "ExpiryMinutes": 60
  }
}
```

If you are using a full SQL Server instance instead of LocalDB, update `DefaultConnection`. Example for a named instance:

```
Server=MY-PC\SQLEXPRESS;Database=CardForge;Trusted_Connection=True;MultipleActiveResultSets=true
```

### 4.3 Run the API

From `cardforge/apps/api/CardForge.Api` (or stay in `cardforge/apps/api` and specify the project):

```cmd
set ASPNETCORE_ENVIRONMENT=Development
dotnet run --project CardForge.Api
```

The API starts on **`http://localhost:5000`**.

On first start you will see log output similar to:

```
HH:mm:ss [INF]  CardForge API starting on Development
HH:mm:ss [INF]  Now listening on: http://localhost:5000
```

#### Swagger UI

While the `ASPNETCORE_ENVIRONMENT` is `Development`, interactive API documentation is available at:

```
http://localhost:5000/swagger
```

#### Health Check

Confirm the API is running:

```
http://localhost:5000/api/health
```

Expected response:

```json
{ "status": "healthy", "version": "1.0.0" }
```

---

## 5. Frontend (Web) Setup

Open a **new terminal window** (keep the API terminal running).

### 5.1 Install Node Dependencies

```cmd
cd cardforge\apps\web
npm install
```

This installs Next.js 14, React 18, Fabric.js, jsPDF, Radix UI components, Tailwind CSS, and all other frontend dependencies.

### 5.2 Configure the API URL

Copy the example environment file:

```cmd
copy .env.local.example .env.local
```

The default value points to the local API — no edits required for local development:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

If your API runs on a different port or host, edit `.env.local` accordingly.

> `.env.local` is gitignored and is never committed.

### 5.3 Run the Frontend

```cmd
npm run dev
```

The frontend starts on **`http://localhost:3000`**.

---

## 6. Seed Demo Data

With the database created and the API running at least once, load the demo accounts and tenant:

```cmd
sqlcmd -S "(localdb)\mssqllocaldb" -d CardForge -i cardforge\scripts\seed.sql
```

Run this command from the **repository root** so the path resolves correctly. Expected output:

```
Seed complete.
Logins:
  superadmin@cardforge.io / Admin123!
  clientadmin@acme.com    / Admin123!
  user@acme.com           / User123!
```

### Demo Accounts

| Email | Password | Role | Tenant |
|---|---|---|---|
| `superadmin@cardforge.io` | `Admin123!` | SuperAdmin | — (platform-wide) |
| `clientadmin@acme.com` | `Admin123!` | ClientAdmin | Acme Corp |
| `user@acme.com` | `User123!` | User | Acme Corp |

The seed script is idempotent — running it multiple times is safe (`IF NOT EXISTS` guards every insert).

---

## 7. Verify the Full Stack

With all three components running, perform this end-to-end check:

1. Open `http://localhost:3000` in a browser.
2. You will be redirected to `/login`.
3. Log in as `clientadmin@acme.com` / `Admin123!`.
4. You should land on the **Dashboard** page inside the Acme Corp tenant.
5. Navigate to **Templates** → **New Template** to open the Fabric.js canvas editor.
6. Navigate to **Cards** → **New Card** to create a business card from a template.
7. Use **Export → Download VCF** on a published card to test VCF generation.

To test SuperAdmin access, log out and log in as `superadmin@cardforge.io` / `Admin123!`. You will see the **Admin → Tenants** menu which lists all tenants.

---

## 8. Production Deployment

### 8.1 Database

Create the `CardForge` database on your production SQL Server. Then apply migrations by running the `dotnet ef database update` command against the production connection string:

```cmd
set ConnectionStrings__DefaultConnection=Server=PROD-SERVER;Database=CardForge;User Id=cardforge_app;Password=...;
dotnet ef database update ^
    --project CardForge.Infrastructure ^
    --startup-project CardForge.Api
```

Alternatively, generate a SQL script from the migrations and run it with your DBA:

```cmd
dotnet ef migrations script ^
    --project CardForge.Infrastructure ^
    --startup-project CardForge.Api ^
    --output cardforge_schema.sql ^
    --idempotent
```

### 8.2 API Configuration

`appsettings.Production.json` is gitignored. Create it on the production server (or use environment variables / a secrets manager):

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=PROD-SERVER;Database=CardForge;User Id=cardforge_app;Password=STRONG_PASSWORD;"
  },
  "JwtSettings": {
    "Secret": "replace-with-a-strong-random-secret-min-32-characters",
    "Issuer": "cardforge",
    "Audience": "cardforge-users",
    "ExpiryMinutes": 60
  },
  "Cors": {
    "AllowedOrigins": [ "https://your-frontend-domain.com" ]
  }
}
```

> The JWT secret must be at least 32 characters and must never be committed to source control.

Publish and run the API:

```cmd
dotnet publish CardForge.Api -c Release -o ./publish
set ASPNETCORE_ENVIRONMENT=Production
dotnet ./publish/CardForge.Api.dll
```

In `Production` mode, Swagger is disabled and stack traces are never included in error responses.

### 8.3 Frontend

Build the Next.js frontend for production:

```cmd
cd cardforge\apps\web
```

Set the API URL for the production build:

```cmd
set NEXT_PUBLIC_API_URL=https://api.your-domain.com
npm run build
npm run start
```

Or export as static files if you are hosting on a CDN:

```cmd
npm run build
```

Then serve the `.next/` output with a Node.js host (e.g., PM2, IIS with iisnode, or a cloud platform).

### 8.4 CORS

`appsettings.json` (`Cors:AllowedOrigins`) controls which frontend origins are allowed. In production, change `http://localhost:3000` to your actual frontend URL. Multiple origins are supported:

```jsonc
"Cors": {
  "AllowedOrigins": [
    "https://app.your-domain.com",
    "https://your-domain.com"
  ]
}
```

### 8.5 Logging

API logs are written to `logs/cardforge-YYYYMMDD.log` (rolling daily, 30-day retention). In production, the minimum log level is `Information` and EF Core SQL queries are suppressed. Ensure the process has write permission to the `logs/` directory.

---

## Quick Reference

| Task | Command |
|---|---|
| Install EF CLI tool | `dotnet tool install --global dotnet-ef` |
| Generate migration | `dotnet ef migrations add InitialCreate --project CardForge.Infrastructure --startup-project CardForge.Api` |
| Apply migration | `dotnet ef database update --project CardForge.Infrastructure --startup-project CardForge.Api` |
| Generate SQL script | `dotnet ef migrations script --project CardForge.Infrastructure --startup-project CardForge.Api --output schema.sql --idempotent` |
| Run API (dev) | `set ASPNETCORE_ENVIRONMENT=Development && dotnet run --project CardForge.Api` |
| Install frontend deps | `npm install` (from `cardforge/apps/web`) |
| Run frontend (dev) | `npm run dev` (from `cardforge/apps/web`) |
| Build frontend (prod) | `npm run build` (from `cardforge/apps/web`) |
| Seed demo data | `sqlcmd -S "(localdb)\mssqllocaldb" -d CardForge -i cardforge\scripts\seed.sql` |
| Health check | `curl http://localhost:5000/api/health` |
| Swagger UI | `http://localhost:5000/swagger` (dev only) |
| Frontend | `http://localhost:3000` |
