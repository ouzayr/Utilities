# ToDoDiary architecture

## Overview

```
┌───────────────────┐        ┌──────────────────────┐
│  Android (Kotlin) │        │   Web (React + TS)   │
│  Compose + InkView│        │   typed tasks + read │
│  S Pen handwriting│        │   -only ink renderer │
└─────────┬─────────┘        └──────────┬───────────┘
          │  Firebase Auth (Google)     │
          └──────────┬──────────────────┘
                     ▼
           Cloud Firestore (source of truth)
           users/{uid}/pages, tasks, carryLinks
```

- **Online-first**: Firestore is the single source of truth on both platforms.
  The Android Firestore SDK has disk persistence enabled by default, so the
  phone keeps working with no signal and syncs when back online.
- **Auth**: Firebase Authentication with Google as the only provider.
  Android uses Credential Manager (`androidx.credentials` + `googleid`);
  web uses `signInWithPopup`.
- Security rules restrict every document to its owner (see `firestore.rules`).

## Firestore data model

```
users/{uid}/pages/{yyyy-MM-dd}
  focusInkJson   string?   portable ink (the FOCUS line, handwritten)
  focusText      string?   typed focus (written from the web)
  notesInkJson   string?   portable ink (freeform notes/scribbles layer)
  template       "DIARY" | "DOT_GRID" | "PLAIN"
  updatedAt      number (epoch ms)

users/{uid}/tasks/{autoId}
  scope          "DAY" | "WEEK"
  pageDate       string?   "2026-07-13" when scope = DAY
  weekId         string?   ISO week "2026-W29" (also set for DAY tasks)
  rowIndex       number    sort key (epoch ms at creation → append order)
  status         "OPEN" | "DONE" | "CARRIED"
  inputType      "INK" | "TEXT"
  textContent    string?
  inkJson        string?   portable ink for handwritten tasks
  carriedToDate  string?   target date/week key once carried
  createdAt / updatedAt    number

users/{uid}/carryLinks/{autoId}
  sourceTaskId, sourceScopeKey, targetKey, createdAt
```

All queries are equality/`in` filters with client-side sorting, so **no
composite indexes are required**.

### Carry-forward semantics (same on both platforms)

Carrying copies the task content (ink or text) to the target day/week as a new
OPEN task, marks the source `CARRIED` (greyed, "→ 14 Jul" tag), and writes a
`CarryLink` — all in one atomic batch. DONE tasks stay struck-through on their
own day forever; they are never auto-carried.

## Portable ink format

Handwriting is never converted to text. Strokes are stored as JSON that both
platforms understand:

```json
{
  "v": 1,
  "cw": 1080.0,
  "strokes": [
    { "c": "#1A237E", "w": 4.0, "p": [x0, y0, p0, x1, y1, p1, ...] }
  ]
}
```

- `cw` — canvas width (px) the strokes were written at; renderers scale by
  `targetWidth / cw`.
- `p` — flat `[x, y, pressure]` triplets; coordinates rounded to 0.1 px,
  pressure to 0.01, keeping a full page of writing in the low hundreds of KB
  (under Firestore's 1 MB document limit).
- Rendering (both platforms): each segment is drawn with width
  `w × (0.35 + 0.85 × pressure^gamma)`, round caps/joins.

## Android app

- **MVVM + Repository**, Hilt DI, coroutines/Flow, Navigation-Compose.
- `ink/` — `InkEngine` interface + `InkView` implementation. `InkView` is a
  custom View: stylus-only input, historical-point capture, pressure-scaled
  segments, committed-stroke bitmap cache, motion-prediction wet tail, whole-
  stroke eraser (side button / inverted pen / toolbar), undo/redo stacks.
  **No ink types leak out of this package** — swap-in of the Jetpack Ink API
  later only touches `ink/`.
- `data/DiaryRepository` — snapshot-listener Flows + batched mutations.
- Autosave: every pen-up triggers a 500 ms-debounced Firestore write per surface.
- Daily/Weekly screens are `HorizontalPager`s with an index↔date mapping, so
  swiping works across ±100 years with lazy page creation (a page exists only
  once something is written on it).
- PDF export renders template + focus + tasks + notes onto A4 via `PdfDocument`
  and opens the system share sheet.

## Design decisions & deviations from the original CLAUDE.md spec

| Decision | Rationale |
|---|---|
| Google auth + Firestore + web companion added | Requested evolution; supersedes the spec's "offline-only, no accounts, no web" non-goals. |
| Firestore online-first (no Room) | Chosen for simplicity ("online-first" option); Firestore's built-in offline cache covers offline writing. |
| Ink stored inline in Firestore docs (not files/Storage) | Keeps setup to Auth+Firestore only; compact format stays well under the 1 MB doc limit; web reads it directly. |
| Custom `InkView` engine instead of Jetpack Ink API (alpha) | The alpha API can't be validated in this build environment; the spec's own risk-mitigation interface (`InkEngine`) is in place so the Ink API can be swapped in behind it without touching the rest of the app. Motion prediction + stylus-only input deliver the core feel. |
| Undo/redo routes to the last-touched focus/notes surface | Task-lane strokes are short; the eraser and per-row Delete cover corrections there. |
| Carry-forward default target: tomorrow | Spec §12 open question — sensible default chosen. |
| Week start follows device/browser locale; week identity is ISO-8601 | Per spec §4; the two agree because the ISO week is derived from the middle of the display week. |
| Week-task section not included in PDF export | Spec §12 open question — kept day pages only for v1. |
| Local zip backup/restore dropped | Firestore is the durable copy; a zip backup of a cloud database added little. |

## Testing

`android/app/src/test` covers the pure logic: ISO week IDs and locale week
starts, ink JSON round-trip/rounding/corruption safety, and Task↔Firestore map
round-trips with unknown-enum fallbacks. Ink rendering and sync are manually
tested on-device per the spec.
