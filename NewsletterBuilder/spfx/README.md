# Newsletter Builder – SharePoint (SPFx) edition

SPFx 1.24 web part (no framework, Heft toolchain). Hosts the shared Newsletter Builder editor and adds SharePoint storage and scheduled sending.

## Deploy (prebuilt)

1. Upload `../releases/newsletter-builder-1.0.0.sppkg` to the tenant **App Catalog** (or a site collection app catalog) → *Enable app*. It's tenant-scoped deployable (`skipFeatureDeployment`), no API permissions requested.
2. On the target site: create a page (a **full-width section** works best) → add the **Newsletter Builder** web part.
3. Open the page once as a **site owner** – the web part checks for the library and list and **creates them if missing** (including any missing columns). Members then only need Contribute rights.
4. Build the Power Automate flow: [`../docs/power-automate-flow.md`](../docs/power-automate-flow.md).

## Web part settings (property pane)

| Setting | Default | Purpose |
|---|---|---|
| Newsletter document library | `Newsletters` | Where newsletters are saved/browsed |
| Schedule list | `Newsletter Schedule` | Rows the flow processes |
| Create automatically if missing | On | Off = never create, show an error instead |
| Check / create now | – | Re-run provisioning (e.g. after renaming) |
| Editor height | 900 | px; `0` = fill the window |
| Default To / Cc / Bcc / Group IDs / Send-from / Send time | – / 09:00 | Pre-fill the Schedule dialog |

## What gets created

**Library** (versioning on): columns `NLNewsletterTitle`, `NLEmailSubject`, `NLFileKind`, `NLAppVersion`. Each save writes three files:
`name.newsletter.json` (editable), `name.email.html` (rendered), `name.mail.json` (Graph message for the flow).

**List**: `NLNewsletterFile`, `NLMailPackageUrl`, `NLEmailSubject`, `NLScheduledSend`, `NLToRecipients`, `NLCcRecipients`, `NLBccRecipients`, `NLRecipientGroupIds`, `NLSendFrom`, `NLImportance`, `NLSendStatus`, `NLSentOn`, `NLStatusMessage`. Full description in the flow doc.

## In the editor

- **Open…** browse/search/delete newsletters in the library · **Save / Save as** · **Import / Export** JSON (move newsletters between the standalone tool and SharePoint).
- **🕑 Schedule send** – saves, validates recipients/size, adds a list row (status `Scheduled`).
- **Schedules** – view status (Scheduled/Sending/Sent/Failed/Cancelled), cancel, re-queue failed sends.

## Build from source

Requires Node 22 LTS.

```bash
npm install
npm run build        # syncs ../standalone/js core, lints, bundles, packages -> sharepoint/solution/newsletter-builder.sppkg
npm start            # local workbench: https://<tenant>.sharepoint.com/_layouts/15/workbench.aspx
npm run bump -- 1.1.0  # sets package.json, package-solution.json and src/version.ts together
```

`src/core/*.js` are copies of `../standalone/js/*` – edit the originals.

## Not tested against a live tenant

The build, packaging and the provisioning logic (against a mocked REST API) are verified. Provisioning, file save/open and list writes use standard SharePoint REST endpoints but have not been run on a real tenant yet – please trial on a test site first.
