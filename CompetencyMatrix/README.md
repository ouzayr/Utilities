# Competency Matrix

A full-page SharePoint Framework (SPFx) web part for SharePoint Online, built with React and [PnPjs](https://pnp.github.io/pnpjs/). It reads two SharePoint lists — one with all competencies and one with all staff (tagged to competencies via a lookup field) — and renders a browsable matrix:

- **All competencies** shown as cards, each with its **leaders** and **staff** underneath.
- **Filter by competency** via a dropdown to show only one.
- **Search for a person** to see which competencies they fall under (with a leader badge), while the cards below narrow to those competencies and highlight the matched person.

The web part supports full-page hosting (`SharePointFullPage`) and full-bleed sections, so it can take over an entire page.

## Expected list schema

Everything below is configurable in the web part property pane; these are the defaults.

### Competencies list (default title: `Competencies`)

| Field | Type | Notes |
| --- | --- | --- |
| `Competency` | Title column (renamed) | Competency name — internal name stays `Title`, which is what the web part reads |
| `Lead` | Person (multi) | The competency's leader(s), shown featured at the top of each card |
| (optional) description field | Text / note | Set its internal name in the property pane to show it on each card |

### Team list (default title: `Team Structure`)

| Field | Type | Notes |
| --- | --- | --- |
| `Resource` | Person | The team member |
| `Competency` | Lookup → Competencies list | Single or multi-value lookups both work. Use a multi-value lookup (or multiple items) to tag someone to several competencies |
| `Start Date` | Date | Set by onboarding. A future start date shows a "from …" badge next to the person |
| `End Date` | Date | Set by offboarding. Once the end date has passed, the person disappears from the matrix |

A person who is both a `Lead` and a `Resource` for the same competency is shown once, in the lead slot.

### RBAC list (default title: `Features RBAC`)

| Field | Type | Notes |
| --- | --- | --- |
| `User` | Person | Who the rule applies to |
| `OnBoarding` | Yes/No | `Yes` shows the **Onboard staff** / **Offboard staff** buttons to that user |

## Onboarding and offboarding

Users listed in `Features RBAC` with `OnBoarding = Yes` get two extra toolbar buttons:

- **Onboard staff** — opens a panel with a people picker (searches the whole tenant), a multi-select of competencies and a start date. One `Team Structure` item is created per selected competency.
- **Offboard staff** — opens a panel to pick an active team member and an end date (their last day). The end date is stamped on all of that person's items; they stay in the matrix until the date has passed, then drop out automatically. Their items are never deleted, so history is kept.

For `Start Date` / `End Date` the web part resolves the internal name automatically (a column created as "Start Date" in the UI gets the internal name `Start_x0020_Date`); the property pane accepts either form.

> **Security note:** the RBAC list only controls whether the buttons are *shown*. Writing to `Team Structure` still happens with the signed-in user's own permissions, so pair this with list permissions (contribute on `Team Structure` for onboarding users, read for everyone else) if enforcement matters.

> Use **internal names** for field settings in the property pane (visible in the field's settings page URL, `Field=...`), not display names. A renamed title column keeps the internal name `Title`.

## Getting started

Prerequisites: Node.js **18.x** and the SPFx toolchain (`npm i -g gulp-cli`).

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
│   ├── CompetencyMatrix.tsx          # Main UI: search, filter, person results, card grid
│   ├── CompetencyCard.tsx            # One competency with its leaders and staff
│   └── CompetencyMatrix.module.scss
├── services/CompetencyService.ts     # All list access via PnPjs (@pnp/sp)
├── models/index.ts                   # ICompetency, IStaffMember, ICompetencyGroup
└── loc/                              # Localized strings
```

Data access notes:

- PnPjs is initialized once in `onInit` with `spfi().using(SPFx(this.context))`.
- Items are fetched with paged async iteration (2000 per page), so lists past the 5000-item view threshold still load.
- Lookup and choice values are normalized so single- and multi-value fields both work.
