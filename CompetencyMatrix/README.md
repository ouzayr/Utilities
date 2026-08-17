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
| `Title` | Single line of text | Competency name |
| (optional) description field | Text / note | Set its internal name in the property pane to show it on each card |

### Staff list (default title: `Staff`)

| Field | Type | Notes |
| --- | --- | --- |
| `Title` (default) | Single line of text | Staff member's name. Can instead be a **Person** field — set its internal name and flip the "is a Person field" toggle |
| `Competency` | Lookup → Competencies list | Single or multi-value lookups both work. One item per person; use a multi-value lookup (or multiple items) to tag someone to several competencies |
| `Role` (optional) | Choice / text | People whose role equals the configured leader value (default `Leader`, case-insensitive) are shown as leaders of their competencies; everyone else is listed as staff. If the field doesn't exist the web part still works — everyone shows as staff |

> Use **internal names** for field settings in the property pane (visible in the field's settings page URL, `Field=...`), not display names.

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
