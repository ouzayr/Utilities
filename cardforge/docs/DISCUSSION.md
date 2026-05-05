# CardForge — Requirements Discussion & Decision Record

This document captures the full requirements conversation, design decisions, and rationale for the CardForge project.

---

## Original Request

The user requested a new project to be added to the Utilities portfolio repository. The project is a **multi-tenant e-business card SaaS platform** with the following core capabilities:

- Companies (tenants) sign up and onboard their staff
- Users design digital business cards using a drag-and-drop canvas editor
- Cards can be exported as VCF (phone contacts), PDF, or PNG
- Tenants can manage shared templates
- Billing and subscriptions are managed at the tenant (company) level

---

## Requirements Clarification Q&A

**Q: What tech stack should be used?**
A: .NET 8 (C#) for the backend, Next.js 14 (TypeScript) for the frontend. Clean Architecture for the backend. Tailwind CSS + shadcn/ui for the frontend UI. Fabric.js for the canvas editor.

**Q: What database?**
A: SQL Server. On Windows development machines, SQL Server Express with LocalDB (`(localdb)\mssqllocaldb`) is the standard — works out of the box with .NET tooling.

**Q: Should Docker be used?**
A: **No Docker.** The user tests on Windows. Everything must run natively on Windows with .NET 8 SDK + Node.js + SQL Server Express. PowerShell scripts replace any shell/container scripts.

**Q: How should configuration be managed?**
A: **All configuration in appsettings files.** No environment variables passed at runtime, no CLI parameters. Three tiers: `appsettings.json` (base), `appsettings.Development.json` (dev machine secrets and connection string), `appsettings.Production.json` (production values filled before deploy). For Next.js, `.env.local` (file-based, standard Next.js convention).

**Q: How should multi-tenancy work?**
A: JWT-based. On login, the JWT embeds `tenantId` and `role` claims. EF Core global query filters on all tenant-scoped entities ensure data isolation automatically. SuperAdmins bypass all filters and can see all tenants.

**Q: What are the user roles?**
A: Four roles in order of authority:
1. **SuperAdmin** — platform operator, manages all tenants
2. **ClientAdmin** — company admin, manages users, templates, subscriptions within their tenant
3. **TemplateManager** — can manage templates if the tenant policy allows
4. **User** — creates and manages their own business cards

**Q: How should template creation be controlled?**
A: Via a `TemplateCreationPolicy` enum stored on each tenant. Four values:
- `PlatformAdminOnly` — only SuperAdmins
- `ClientAdminOnly` — ClientAdmin or above
- `TemplateManagerOrAbove` — TemplateManager, ClientAdmin, or SuperAdmin
- `AnyUser` — any user in the tenant

**Q: What subscription tiers are needed?**
A: Three tiers:
- **Starter** (free): 10 users, 3 templates, VCF export only
- **Professional** ($29/mo): 50 users, 20 templates, VCF + PDF/PNG
- **Enterprise** ($99/mo): unlimited users and templates, all exports, white-label branding

**Q: How should billing be handled?**
A: Stubbed initially. An `IPaymentProvider` interface with a `StubPaymentProvider` that always returns success. Swapping in Stripe or Paddle means registering a different implementation in `Program.cs` only — no other code changes needed.

**Q: How does the subscription history work?**
A: A tenant can have multiple `Subscription` records over time. Each subscription has exactly one `BillingDetails` (enforced with a UNIQUE FK). On upgrade: the old subscription is cancelled, a new one is inserted. The active tier is the highest-tier subscription with `Status = "Active"`.

**Q: How should exports work?**
A: 
- **VCF**: Server-side. The API reads the card's `FieldValues` JSON, maps them to vCard 3.0 fields, returns `text/vcard` with `Content-Disposition: attachment`. Works on any device — iOS and Android will open the contacts import dialog.
- **PNG**: Client-side. Fabric.js `canvas.toDataURL({ format: 'png', multiplier: 3 })` at 3x resolution.
- **PDF**: Client-side. `jspdf` at 3.5" × 2" business card dimensions.
- PNG and PDF are gated behind the Professional tier.

**Q: What documentation is needed?**
A: Four documents:
1. `PLAN.md` — implementation plan with completion status (this living document)
2. `DISCUSSION.md` — full requirements conversation and decision record (this file)
3. `USER_GUIDE.md` — end-user guide (onboarding, editor, export, billing)
4. `TECHNICAL_GUIDE.md` — developer guide (setup, architecture, API reference)

**Q: What error handling and logging is needed?**
A: 
- Serilog with rolling file sink + console sink
- `ExceptionHandlingMiddleware` — global catch → RFC 7807 ProblemDetails → Serilog logs with full context
- `CorrelationIdMiddleware` — `X-Correlation-Id` header per request, enriched into all log entries
- `TenantMiddleware` — pushes `TenantId` and `UserId` into Serilog log context
- Custom application exceptions with HTTP status code mapping
- Frontend: typed `ApiError` interface, React Error Boundaries, toast notifications

---

## Architecture Decisions Log

### Why Clean Architecture?
Separates domain logic from infrastructure concerns. Makes it easy to:
- Swap SQL Server for another database (change EF provider in Infrastructure only)
- Swap StubPaymentProvider for a real one (register different implementation in DI)
- Test application services in isolation with mock `IAppDbContext`

### Why Minimal API over MVC Controllers?
Minimal API in .NET 8 is less ceremony. Endpoint groups (`MapGroup`) provide the same logical organization as controllers without the attribute boilerplate. Better performance for high-throughput scenarios.

### Why Fabric.js for the canvas editor?
- Full JSON serialization/deserialization (`canvas.toJSON`, `canvas.loadFromJSON`) — exactly what's needed to persist canvas state in the database
- Custom object properties preserved in serialization (enables `placeholder` binding)
- Mature library with built-in selection, grouping, z-order, IText editing

### Why JWT (not cookie-based auth)?
JWT works cleanly with Next.js → .NET cross-origin requests. The token carries `tenantId` and `role` claims directly, avoiding a database lookup on every request to resolve the current tenant.

### Why `IPaymentProvider` stub?
The billing flow is designed to be payment-processor agnostic from day one. The stub satisfies the full subscription lifecycle for development without any external dependencies. Integrating a real processor (Stripe, Paddle) is a one-file change.

### Why EF Core global query filters for multi-tenancy?
Filters are defined once in `AppDbContext.OnModelCreating` and apply to every LINQ query automatically. No risk of forgetting a `WHERE TenantId = ?` clause. SuperAdmin bypass is clean (`_currentTenant.IsSuperAdmin`).

### Why vCard 3.0?
Maximum compatibility across iOS, Android, Windows Contacts, Outlook, and Google Contacts. vCard 4.0 is not universally supported on older devices.

---

## Deferred / Out of Scope (v1)

- Docker / containerization
- Real payment processor integration
- Image upload / blob storage
- QR code rendering in cards
- Email notifications (user invites, subscription confirmations)
- Refresh token persistence (currently stateless)
- White-label domain configuration
- Unit and integration tests
- Platform admin tenant management detail page
- Rate limiting / API throttling
- Audit log table
