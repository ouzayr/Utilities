# Newsletter Builder

Build Outlook-ready HTML email newsletters with a visual section editor. Two editions share the same editor core:

| | Standalone (HTML/JS) | SharePoint (SPFx web part) |
|---|---|---|
| Runs | Double-click `standalone/NewsletterBuilder.html` in Edge/Chrome | Web part on any modern SharePoint page (full-width or app page) |
| Storage | `.newsletter.json` files on your laptop (Open / Save / Save as) | Document library (browse, open, delete) + JSON import/export |
| Sending | Open in Outlook (.eml), Copy for Outlook, HTML copy/download | Same, plus **Schedule send** → SharePoint list → Power Automate |
| Setup | None | Upload `.sppkg` once to the App Catalog |

Version is shown in the editor footer (`Newsletter Builder v1.0.0`).

## Features

- **Layouts (templates):** People & culture update, Classic newsletter, Single announcement, Two-column digest, Blank.
- **Sections:** Header/banner, Heading, Text (bold/italic/underline/links/lists), Image (link, caption, width), Button, Image + text (left/right), Columns (2–3), Links list, Divider, Spacer, Footer.
- **People sections** – each person has name + photo plus:
  1. **New joiners** – job title, team, buddy, joining date, short bio
  2. **Birthdays & weddings** – occasion (birthday, wedding, engagement, new baby, work anniversary, custom), team, date (year hidden for birthdays), message
  3. **Promotions** – previous role, new role, team, effective date, message
  4. **Exam passes** – exam/certification, awarding body, result, team, date, message

  Per section: cards per row (1–4), round/square photos, photo size, alignment, card colours, accent bar, and **editable field labels** (e.g. rename "Buddy" to "Mentor", or blank a label to hide it).
- **Editing:** click a section on the canvas to edit; reorder with arrows or drag in Outline; duplicate/delete; undo/redo (Ctrl+Z / Ctrl+Y); desktop/mobile preview; theme presets, colours, fonts, width, date format.
- **Images** are resized and compressed on upload (photos square-cropped to 320 px) so emails stay small. Drag & drop, paste, or use a URL.
- **Email output** is table-based with inline styles and Outlook (MSO) fallbacks; columns stack on mobile.
- **Safety:** rich text is sanitised; browser keeps a draft backup and offers to restore unsaved work.

## Getting the email into Outlook

| Option | Best for | Notes |
|---|---|---|
| **Open in Outlook (.eml)** – recommended | Classic Outlook (Windows/Mac) | Opens as a new draft with images embedded as inline attachments. Add recipients, send. |
| **Copy for Outlook** | New Outlook / Outlook on the web | Paste (Ctrl+V) into a new message. Uploaded images are `data:` URIs – if your Outlook strips them, use the .eml route or host images at a URL. |
| **Copy HTML / Download HTML** | Other mail tools | Raw HTML. |
| **Schedule send** (SPFx) | Unattended sends | Flow sends via Graph with inline images – works in every Outlook client. |

Known rendering limits (all email tools share these): classic Outlook ignores rounded corners (photos show square) and mobile stacking; layout stays intact.

## Folder layout

```
NewsletterBuilder/
  standalone/
    index.html                 dev entry (loads js/*)
    NewsletterBuilder.html     single-file build - copy this anywhere
    js/nl-core.js              model, templates, renderer, .eml/Graph packaging  (shared source of truth)
    js/nl-editor.js            editor UI (shared source of truth)
    js/app-standalone.js       local-file host
  spfx/                        SharePoint Framework 1.24 solution (see spfx/README.md)
  releases/newsletter-builder-1.0.0.sppkg   prebuilt SharePoint package
  docs/power-automate-flow.md  flow that sends scheduled newsletters
  scripts/build-single-file.js
```

## Development

- Edit the shared core in `standalone/js/`. Then:
  - `node scripts/build-single-file.js` – refresh `standalone/NewsletterBuilder.html`
  - SPFx copies the core automatically on `npm run build` / `npm start` (`spfx/scripts/sync-core.js`)
- Bump versions: standalone → `APP_VERSION` in `standalone/js/app-standalone.js`; SPFx → `npm run bump -- 1.1.0` in `spfx/`; core → `VERSION` in `nl-core.js`.
- Newsletter files carry `schemaVersion` and `appVersion`; older files are upgraded on open, newer-schema files are refused with a clear message.
