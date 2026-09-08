# Competency Matrix

A full-page SharePoint Framework (SPFx) web part for SharePoint Online, built with React and [PnPjs](https://pnp.github.io/pnpjs/). It reads three SharePoint lists — competencies, team structure and a small access-control list — and renders a browsable matrix:

- **All competencies** shown as cards, each with its **lead**, **manager** and **team** underneath.
- **Filter by competency** via a dropdown to show only one.
- **Search for a person** to see which competencies they fall under and in which role, while the cards below narrow to those competencies and highlight the matched person.
- **Click any person** for a Teams-style profile card with a large photo.
- **Export to Excel**, **onboard** and **offboard** staff, and **refresh** the data in place.

The web part supports full-page hosting (`SharePointFullPage`) and full-bleed sections, so it can take over an entire page.

## Expected list schema

Everything below is configurable in the web part property pane; these are the defaults.

### Competencies list (default title: `Competencies`)

| Field | Type | Notes |
| --- | --- | --- |
| `Competency` | Title column (renamed) | Competency name — internal name stays `Title`, which is what the web part reads |
| `Lead` | Person (multi) | The competency's leader(s), shown at the top of each card |
| `Manager` | Person (single or multi) | The competency's manager(s), shown in their own section between Lead and Team |
| (optional) description field | Text / note | Set its internal name in the property pane to show it on each card |

### Team list (default title: `Team Structure`)

| Field | Type | Notes |
| --- | --- | --- |
| `Resource` | Person | The team member |
| `Competency` | Lookup → Competencies list | Single or multi-value lookups both work. Use a multi-value lookup (or multiple items) to tag someone to several competencies |
| `Start Date` | Date | Set by onboarding. A future start date shows a "from …" badge next to the person |
| `End Date` | Date | Set by offboarding. Once the end date has passed, the person disappears from the matrix |

A person who is a `Lead` or `Manager` of a competency is never listed again under that competency's Team section — each person appears once per competency, in their highest role.

### RBAC list (default title: `Features RBAC`)

| Field | Type | Notes |
| --- | --- | --- |
| `User` | Person | Who the rule applies to |
| `OnBoarding` | Yes/No | `Yes` shows the **Onboard staff** / **Offboard staff** buttons to that user |

## Onboarding and offboarding

Users listed in `Features RBAC` with `OnBoarding = Yes` get two extra toolbar buttons:

- **Onboard staff** — opens a panel with a people picker (searches the whole tenant), a multi-select of competencies and a start date. A **single** `Team Structure` item is created holding every selected competency (the lookup column accepts multiple values); if the column is single-value, it falls back to one item per competency.
- **Offboard staff** — opens a panel to pick an active team member and an end date (their last day). The end date is stamped on all of that person's items; they stay in the matrix until the date has passed, then drop out automatically. Their items are never deleted, so history is kept.

For `Start Date` / `End Date` the web part resolves the internal name automatically (a column created as "Start Date" in the UI gets the internal name `Start_x0020_Date`); the property pane accepts either form.

## Other features

- **Person details** — clicking anyone on a card or in the search results opens a Teams-style modal with their large profile photo, email, when they joined the team, shortcuts to chat in Teams or send email, and every competency they belong to grouped by role.
- **Export to Excel** — the toolbar's **Export** menu writes a real `.xlsx` with the columns **Competency, Role, Name, Email** (one row per person per competency). Choose *Export current view* to export exactly what the filter and search are showing, or *Export all competencies*. The workbook is generated in the browser with no external dependency.
- **Refresh** — the refresh button re-reads both lists and updates the view in place, without reloading the page or the web part.

> **Security note:** the RBAC list only controls whether the buttons are *shown*. Writing to `Team Structure` still happens with the signed-in user's own permissions, so pair this with list permissions (contribute on `Team Structure` for onboarding users, read for everyone else) if enforcement matters.

> Use **internal names** for field settings in the property pane (visible in the field's settings page URL, `Field=...`), not display names. A renamed title column keeps the internal name `Title`.

## Getting started

Prerequisites: Node.js **18.x or 20.x** (SPFx 1.20 does not support Node 22+) and the SPFx toolchain (`npm i -g gulp-cli`).

```bash
cd CompetencyMatrix
npm install
```

### Local workbench

Edit `config/serve.json` and replace `{tenantDomain}` with your site, e.g. `https://contoso.sharepoint.com/sites/hr`, then:

```bash
gulp serve
```

The hosted workbench opens; add the **Competency Matrix** web part and point it at your lists via the property pane.

### Package for deployment

```bash
npm run package
```

Upload `sharepoint/solution/competency-matrix.sppkg` to your tenant (or site) App Catalog. The solution uses `skipFeatureDeployment: true`, so you can make it available tenant-wide without per-site installs.

To use it as a full page: create a new page from **Apps** (single-part app page) and pick Competency Matrix, or add it to a **full-width section** on a normal page.

## Project structure

```
src/webparts/competencyMatrix/
├── CompetencyMatrixWebPart.ts        # Web part entry, property pane, PnPjs setup
├── components/
│   ├── CompetencyMatrix.tsx          # Main UI: toolbar, search, filter, export, card grid
│   ├── CompetencyCard.tsx            # One competency: lead, manager and team sections
│   ├── PersonDetailsModal.tsx        # Teams-style person profile modal
│   ├── OnboardPanel.tsx              # People picker + competencies + start date
│   ├── OffboardPanel.tsx             # Team member + end date
│   └── CompetencyMatrix.module.scss
├── services/
│   ├── CompetencyService.ts          # All list access via PnPjs (@pnp/sp)
│   └── ExcelExport.ts                # Dependency-free .xlsx writer
├── models/index.ts                   # ICompetency, IStaffMember, IPersonMatch, ...
└── loc/                              # Localized strings
```

Data access notes:

- PnPjs is initialized once in `onInit` with `spfi().using(SPFx(this.context))`.
- Items are fetched with paged async iteration (2000 per page), so lists past the 5000-item view threshold still load.
- Lookup and person values are normalized so single- and multi-value fields both work.
- Field internal names are discovered from the list itself, so the property pane accepts either the display name ("Start Date") or the internal name (`Start_x0020_Date`).
