# CardForge — Technical Guide

## Prerequisites (Windows)

| Tool | Version | Download |
|---|---|---|
| .NET SDK | 8.0+ | https://dotnet.microsoft.com/download |
| Node.js | 20 LTS+ | https://nodejs.org |
| SQL Server Express | 2019+ | https://www.microsoft.com/sql-server |
| SQL Server command-line tools | (sqlcmd) | Installed with SQL Server Express |
| Git | Any | https://git-scm.com |

> SQL Server Express installs **LocalDB** automatically. The default connection string uses `(localdb)\mssqllocaldb` which requires no configuration.

---

## Local Setup (Windows, No Docker)

### 1. Clone the repository

```powershell
git clone <repo-url>
cd Utilities/cardforge
```

### 2. Configure the API

Open `apps/api/CardForge.Api/appsettings.Development.json`. The defaults work out of the box with SQL Server LocalDB:

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=CardForge;Trusted_Connection=True;"
  },
  "JwtSettings": {
    "Secret": "dev-only-jwt-secret-change-in-prod-32chars!",
    "Issuer": "cardforge-dev",
    "Audience": "cardforge-users",
    "ExpiryMinutes": 60
  }
}
```

**For production:** fill in `appsettings.Production.json` with your real SQL Server connection string and a strong JWT secret (minimum 32 characters).

### 3. Configure the frontend

```powershell
cd apps/web
Copy-Item .env.local.example .env.local
```

The default `.env.local` points to `http://localhost:5000` which is correct for local development.

### 4. Start the API

```powershell
# From repo root
.\scripts\dev-api.ps1
```

This script:
1. Runs `dotnet ef database update` to create/migrate the database
2. Starts the API at `http://localhost:5000`
3. Swagger UI is available at `http://localhost:5000/swagger` in Development

### 5. Seed demo data (optional)

```powershell
sqlcmd -S "(localdb)\mssqllocaldb" -d CardForge -i scripts\seed.sql
```

Demo accounts created:
| Email | Password | Role |
|---|---|---|
| superadmin@cardforge.io | Admin123! | SuperAdmin |
| clientadmin@acme.com | Admin123! | ClientAdmin (Acme Corp) |
| user@acme.com | User123! | User (Acme Corp) |

### 6. Start the frontend

```powershell
# From repo root (separate terminal)
.\scripts\dev-web.ps1
```

Frontend available at `http://localhost:3000`.

---

## Project Structure

```
cardforge/
├── docs/               ← documentation (you are here)
├── scripts/            ← dev scripts and seed SQL
└── apps/
    ├── api/            ← .NET 8 backend
    │   ├── CardForge.Domain/           ← entities, enums (no dependencies)
    │   ├── CardForge.Application/      ← services, DTOs, interfaces, exceptions
    │   ├── CardForge.Infrastructure/   ← EF Core, JWT, payment stub
    │   └── CardForge.Api/              ← Minimal API endpoints, middleware, Program.cs
    └── web/            ← Next.js 14 TypeScript frontend
        └── src/
            ├── app/            ← Next.js App Router pages
            ├── components/     ← React components
            ├── lib/            ← API client, auth helpers, Fabric.js helpers
            └── types/          ← TypeScript interfaces
```

---

## Architecture Overview

### Clean Architecture Layers

```
CardForge.Api
    → CardForge.Application (interfaces, services, DTOs, exceptions)
    → CardForge.Infrastructure (EF Core, JWT, payment)
    → CardForge.Domain (entities, enums — no dependencies)
```

- **Domain**: Pure C# classes. No framework dependencies.
- **Application**: Business logic. Depends only on Domain + abstractions (interfaces). Does not reference EF Core or ASP.NET directly.
- **Infrastructure**: Implements the interfaces (EF Core `AppDbContext`, `JwtService`, `StubPaymentProvider`, `VcfGenerator`, `HttpCurrentTenant`).
- **Api**: Wires everything together in `Program.cs`. Registers DI, configures middleware, maps endpoints.

### Multi-Tenancy

Every authenticated request goes through:
1. `UseAuthentication()` — validates JWT, populates `HttpContext.User`
2. `TenantMiddleware` — pushes `TenantId` and `UserId` into Serilog log context
3. `ICurrentTenant` (scoped, `HttpCurrentTenant`) — reads claims from `IHttpContextAccessor`

**EF Core global query filters** (defined in `AppDbContext.OnModelCreating`):
```csharp
entity.HasQueryFilter(e =>
    _currentTenant.IsSuperAdmin || e.TenantId == _currentTenant.TenantId);
```

SuperAdmins bypass all filters. All other users only see data belonging to their tenant.

### JWT Token Structure

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "role": "ClientAdmin",
  "tenantId": "<tenantId>",
  "exp": 1234567890,
  "iss": "cardforge-dev",
  "aud": "cardforge-users"
}
```

---

## Configuration Reference

### `appsettings.json` (base — all environments)

| Key | Description |
|---|---|
| `Cors:AllowedOrigins` | Array of allowed frontend origins |
| `Serilog:MinimumLevel:Default` | Root log level (Information in prod, Debug in dev) |
| `Serilog:WriteTo[File]:Args:path` | Log file path (rolling, `logs/cardforge-.log`) |
| `Serilog:WriteTo[File]:Args:retainedFileCountLimit` | Days of logs to keep (30) |

### `appsettings.Development.json` / `appsettings.Production.json`

| Key | Description |
|---|---|
| `ConnectionStrings:DefaultConnection` | SQL Server connection string |
| `JwtSettings:Secret` | JWT signing secret (min 32 chars) |
| `JwtSettings:Issuer` | JWT issuer claim |
| `JwtSettings:Audience` | JWT audience claim |
| `JwtSettings:ExpiryMinutes` | Token expiry in minutes |

> **Security note:** Never commit a production JWT secret to source control. Use `appsettings.Production.json` (gitignored) or a secrets manager.

### `.env.local` (Next.js frontend)

| Key | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the CardForge API (e.g. `http://localhost:5000`) |

---

## Database

### Running Migrations

```powershell
cd apps/api
dotnet ef migrations add <MigrationName> \
    --project CardForge.Infrastructure \
    --startup-project CardForge.Api
dotnet ef database update \
    --project CardForge.Infrastructure \
    --startup-project CardForge.Api
```

> In Development, `Program.cs` calls `db.Database.Migrate()` on startup automatically.

### Initial Migration

The `InitialCreate` migration must be generated before first use:

```powershell
cd apps/api
dotnet ef migrations add InitialCreate \
    --project CardForge.Infrastructure \
    --startup-project CardForge.Api
```

### Schema Notes

- `Users.Email` — UNIQUE index
- `Tenants.Slug` — UNIQUE index
- `BillingDetails.SubscriptionId` — UNIQUE (enforces 1:1 with Subscription)
- `Template.FabricJson` — `nvarchar(max)` (stores full Fabric.js canvas JSON)
- `Card.FieldValues` — `nvarchar(max)` (stores `{"key": "value"}` field bindings)

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register new tenant + admin user |
| POST | `/api/auth/login` | None | Login, returns JWT |
| POST | `/api/auth/refresh` | Bearer | Refresh token |
| GET | `/api/auth/me` | Bearer | Current user info + active tier |

### Tenants (SuperAdmin only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/tenants` | List all tenants |
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/{id}` | Get tenant |
| PUT | `/api/tenants/{id}` | Update tenant |
| DELETE | `/api/tenants/{id}` | Delete tenant |
| PUT | `/api/tenants/{id}/policy` | Update template creation policy |

### Users

| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List users in tenant |
| POST | `/api/users` | Create user (ClientAdmin+) |
| GET | `/api/users/{id}` | Get user |
| PUT | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Delete user |
| PUT | `/api/users/{id}/role` | Update user role |

### Templates

| Method | Path | Description |
|---|---|---|
| GET | `/api/templates` | List templates (tenant + global) |
| POST | `/api/templates` | Create template (policy-gated) |
| GET | `/api/templates/{id}` | Get template |
| PUT | `/api/templates/{id}` | Update template |
| DELETE | `/api/templates/{id}` | Delete template |
| POST | `/api/templates/{id}/publish` | Publish template |

### Cards

| Method | Path | Description |
|---|---|---|
| GET | `/api/cards` | List user's cards |
| POST | `/api/cards` | Create card |
| GET | `/api/cards/{id}` | Get card |
| PUT | `/api/cards/{id}` | Update card |
| DELETE | `/api/cards/{id}` | Delete card |
| POST | `/api/cards/{id}/publish` | Publish card |

### Subscriptions

| Method | Path | Description |
|---|---|---|
| GET | `/api/subscriptions` | List tenant subscriptions |
| POST | `/api/subscriptions` | Create/upgrade subscription |
| PUT | `/api/subscriptions/{id}/cancel` | Cancel subscription |
| GET | `/api/subscriptions/{id}/billing` | Get billing details |

### Export

| Method | Path | Description |
|---|---|---|
| GET | `/api/export/cards/{id}/vcf` | Download VCF contact file |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check (no auth required) |

---

## Error Handling

All errors return RFC 7807 `application/problem+json`:

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "Card '...' was not found.",
  "instance": "/api/cards/..."
}
```

For tier limit errors (`402`), the response also includes:
```json
{
  "status": 402,
  "title": "Subscription Limit Reached",
  "detail": "Your Starter plan allows a maximum of 10 users.",
  "currentTier": "Starter",
  "requiredTier": "Professional"
}
```

Stack traces are never included in non-Development environments.

---

## Logging

Logs are written to:
- **Console** — formatted for human reading in dev
- **File** — `apps/api/CardForge.Api/logs/cardforge-YYYYMMDD.log` (rolling daily, 30-day retention)

Each log entry includes:
- `CorrelationId` — from `X-Correlation-Id` request header (auto-generated if absent)
- `TenantId` — from JWT claim
- `UserId` — from JWT claim
- `MachineName`, `ThreadId`

Log levels by environment:
- **Development**: `Debug` (includes EF Core SQL queries)
- **Production**: `Information` (Microsoft framework warnings only)

---

## Adding a Real Payment Provider

1. Create a new class implementing `IPaymentProvider` in `CardForge.Infrastructure/Billing/`
2. In `CardForge.Api/Program.cs`, change:
   ```csharp
   // Before:
   builder.Services.AddScoped<IPaymentProvider, StubPaymentProvider>();
   
   // After:
   builder.Services.AddScoped<IPaymentProvider, StripePaymentProvider>();
   ```
3. Add any provider-specific configuration to `appsettings.json`

No other code changes are required.

---

## Frontend Architecture

The frontend uses Next.js 14 App Router with route groups:
- `(auth)` — login and register pages (no layout shell)
- `(tenant)` — all tenant-scoped pages with `TenantShell` sidebar
- `(platform)` — SuperAdmin pages with `PlatformShell` sidebar

### Key Files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | Typed fetch wrapper, reads JWT from localStorage |
| `src/lib/auth.ts` | login/register/logout/getMe helpers |
| `src/lib/fabricHelpers.ts` | Canvas init, JSON serialization, placeholder binding |
| `src/lib/exportHelpers.ts` | PNG, PDF, VCF download utilities |
| `src/components/editor/FabricCanvas.tsx` | Fabric.js canvas, lazy-loaded |
| `src/components/subscription/TierGate.tsx` | Wraps UI that requires a minimum plan tier |

### Authentication Flow

1. User logs in → `POST /api/auth/login` → JWT stored in `localStorage` as `cf_token`
2. `api.ts` reads token on every request, adds `Authorization: Bearer <token>` header
3. On 401/403 errors, toast notification shown; logout clears localStorage
4. `getStoredAuth()` used by the root page to redirect to dashboard or login

### Fabric.js Canvas

Fabric.js is lazy-loaded with `await import("fabric")` to avoid SSR issues. The canvas initializes at `1050 × 600` pixels (representing 3.5" × 2" at 300 DPI ÷ ~1px per unit). Canvas JSON is serialized with custom properties `['id', 'placeholder', ...]` and stored as `nvarchar(max)` in the database.

---

## Subscription Tier Limits (Code Reference)

Limits are static constants in `CardForge.Application/Services/UserService.cs`:

```csharp
public static class TierLimits
{
    public static int MaxUsers(SubscriptionTier tier) => tier switch
    {
        SubscriptionTier.Starter      => 10,
        SubscriptionTier.Professional => 50,
        SubscriptionTier.Enterprise   => int.MaxValue,
        _ => 10
    };

    public static int MaxTemplates(SubscriptionTier tier) => ...
    public static bool CanExportPdf(SubscriptionTier tier) => tier >= SubscriptionTier.Professional;
    public static bool HasWhiteLabel(SubscriptionTier tier) => tier == SubscriptionTier.Enterprise;
}
```

---

## Running Tests

> Tests are not yet implemented. Planned: xUnit + Testcontainers for integration tests against a real SQL Server instance.

When added, run with:
```powershell
cd apps/api
dotnet test
```
