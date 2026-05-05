# CardForge — Implementation Plan & Status

## Project Overview

Multi-tenant e-business card SaaS platform. Companies (tenants) onboard users who design business cards via a drag-and-drop editor, export them as VCF/PDF/PNG, and manage templates. Billing and subscriptions are at the tenant level.

---

## Completion Checklist

### Phase 1 — Backend Foundation
- [x] Solution structure (CardForge.sln with 4 projects)
- [x] Domain entities (Tenant, AppUser, Template, Card, Subscription, BillingDetails)
- [x] Domain enums (UserRole, SubscriptionTier, TemplateCreationPolicy)
- [x] Application interfaces (IAppDbContext, ICurrentTenant, IJwtService, IPaymentProvider, IVcfGenerator)
- [x] Application exceptions (NotFoundException, ForbiddenException, ConflictException, TierLimitException)
- [x] Application DTOs (Auth, Card, Template, Subscription, Tenant)
- [x] Application services (AuthService, UserService, TenantService, TemplateService, CardService, SubscriptionService, VcfService)
- [x] Infrastructure: AppDbContext with global query filters + EF Core config
- [x] Infrastructure: JwtService (token generation + refresh token)
- [x] Infrastructure: HttpCurrentTenant (JWT claim extraction)
- [x] Infrastructure: StubPaymentProvider (always succeeds)
- [x] Infrastructure: VcfGenerator (vCard 3.0)

### Phase 2 — API Layer
- [x] Program.cs (Serilog bootstrap, DI registration, middleware pipeline, EF auto-migrate in dev)
- [x] appsettings.json / Development / Production configs (no runtime parameters)
- [x] ExceptionHandlingMiddleware (global catch → RFC 7807 ProblemDetails + Serilog)
- [x] CorrelationIdMiddleware (X-Correlation-Id header → log context)
- [x] TenantMiddleware (JWT claims → Serilog log context)
- [x] Auth endpoints (register, login, refresh, me)
- [x] Tenant endpoints (CRUD + policy update, SuperAdmin only)
- [x] User endpoints (CRUD + role update, scoped by tenant)
- [x] Template endpoints (CRUD + publish, scoped by TemplateCreationPolicy)
- [x] Card endpoints (CRUD + publish, scoped by user/admin)
- [x] Subscription endpoints (list, create/upgrade, cancel, billing)
- [x] Export endpoints (VCF server-side)
- [x] Health check endpoint

### Phase 3 — Frontend
- [x] Next.js 14 + TypeScript + Tailwind CSS setup
- [x] package.json, tsconfig.json, next.config.ts, tailwind.config.ts
- [x] Type definitions (types/index.ts)
- [x] API client wrapper (lib/api.ts)
- [x] Auth utilities (lib/auth.ts)
- [x] Fabric.js helpers (lib/fabricHelpers.ts)
- [x] Export helpers (lib/exportHelpers.ts)
- [x] Login page
- [x] Register page (tenant + admin user creation)
- [x] Dashboard page
- [x] Users page
- [x] Templates page (policy-gated New button)
- [x] Cards page
- [x] Subscriptions page (tier cards + billing history)
- [x] Platform admin — Tenants list page
- [x] FabricCanvas component (Fabric.js v5, lazy-loaded)
- [x] Toolbar component (add text/shapes, layer order, delete, undo)
- [x] ExportBar component (VCF always, PNG/PDF tier-gated)
- [x] TierGate component
- [x] TenantShell + PlatformShell layouts
- [x] Card editor page
- [x] Template editor page

### Phase 4 — DevOps & Scripts
- [x] scripts/dev-api.ps1 (Windows PowerShell, runs migrations + API)
- [x] scripts/dev-web.ps1 (Windows PowerShell, installs deps + Next.js dev server)
- [x] scripts/seed.sql (demo tenant, 3 users, Starter subscription)
- [x] .gitignore

### Phase 5 — Documentation
- [x] docs/PLAN.md (this file)
- [x] docs/DISCUSSION.md (requirements discussion record)
- [x] docs/USER_GUIDE.md (end-user guide)
- [x] docs/TECHNICAL_GUIDE.md (developer guide)

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | .NET 8 Minimal API | Modern, performant, Clean Architecture friendly |
| Frontend framework | Next.js 14 | App Router, server components, well-supported |
| Canvas editor | Fabric.js v5 | Best-in-class browser canvas with full serialization |
| ORM | Entity Framework Core 8 | Best .NET ORM, global query filters for multi-tenancy |
| Multi-tenancy | JWT claims + EF global filters | Simple, no schema-per-tenant complexity |
| Billing | Stub IPaymentProvider | Defer real payment integration, keep interface clean |
| Logging | Serilog | Structured logging, rolling files, correlation IDs |
| Error handling | Global middleware → ProblemDetails | RFC 7807 standard, no stack traces in prod |
| Auth | JWT Bearer | Stateless, carries tenantId + role claims |

---

## Known Limitations & Deferred Items

- [ ] **EF Migrations**: `InitialCreate` migration not yet generated — run `dotnet ef migrations add InitialCreate` before first use
- [ ] **Image upload**: Placeholder images in templates not yet implemented (no blob storage wired)
- [ ] **QR code generation**: QR placeholder type defined but not rendered
- [ ] **Real payment processor**: `StubPaymentProvider` always succeeds — implement `IPaymentProvider` with Stripe/Paddle when ready
- [ ] **Refresh token storage**: Refresh tokens are generated but not persisted (stateless only) — add `RefreshToken` table for production
- [ ] **Platform admin tenant create page**: `/admin/tenants/[id]` manage page not yet implemented
- [ ] **White-label**: `WhiteLabelEnabled` flag on tenant is stored but branding injection not yet wired
- [ ] **Tests**: No unit or integration tests yet — add xUnit + Testcontainers

---

## Verification Steps (Windows, No Docker)

```powershell
# Terminal 1 — API
.\scripts\dev-api.ps1
# → API listening at http://localhost:5000
# → Swagger UI at http://localhost:5000/swagger

# Terminal 2 — Seed
sqlcmd -S "(localdb)\mssqllocaldb" -d CardForge -i scripts\seed.sql

# Terminal 3 — Frontend
.\scripts\dev-web.ps1
# → http://localhost:3000

# Smoke tests
# 1. curl http://localhost:5000/api/health  → {"status":"healthy","version":"1.0.0"}
# 2. Login as clientadmin@acme.com / Admin123!  → JWT returned
# 3. Dashboard shows "Starter" tier badge
# 4. Templates → "New Template" visible for ClientAdmin
# 5. Create card → save → download VCF → verify BEGIN:VCARD
# 6. Login as user@acme.com → try create template → 403 toast
# 7. Check apps/api/logs/ for rolling log file
```
