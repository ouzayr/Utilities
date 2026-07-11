# CLAUDE.md — Ink Diary (working title)

> Project context for Claude Code. Read this fully before writing code.
> This app has **one job**: replicate a paper daily diary on a Galaxy S25 Ultra with S Pen, where handwriting fidelity is the entire product. Do not turn it into a generic to-do app.

---

## 1. Vision & Non-Negotiables

The user tracks tasks by hand in a paper diary: one page per day, freeform ink, scribbles in the margin, cross-out to complete, and re-write a task onto a future page to defer it. Every existing digital task app failed because it converts ink into typed database rows. **This app must keep the ink.**

The core insight: instead of recognising handwriting into text, we keep strokes as first-class data and use **stroke geometry** (select / move / copy) to deliver the "carry a task forward" gesture. Nothing is transcribed unless the user explicitly opts in later.

**Non-negotiables**
- Writing latency must feel like pen on paper (target ≤ ~5ms wet-ink latency; use the low-latency path, not a naive `Canvas`+`Path`).
- Finger = navigate/pan. **S Pen = draw.** Palm never draws (palm rejection on).
- Fully offline. No account, no server, no login for v1.
- One page = one day. Swipe or jump to any date. Pages are infinite (past and future).

---

## 2. Target Device & Environment

| Item | Value |
|---|---|
| Primary device | Samsung Galaxy S25 Ultra (S Pen, ~120Hz, One UI 7 / Android 15) |
| Language | Kotlin |
| UI | Jetpack Compose |
| Min SDK | 29 (Android 10) |
| Target/Compile SDK | Latest stable |
| Orientation | Portrait-first (support landscape but optimise portrait) |
| Form factor | Phone-first. Do not build for tablet/foldable in v1. |

---

## 3. Tech Stack (use these; do not substitute without asking)

| Concern | Choice | Notes |
|---|---|---|
| Ink capture/render | **Jetpack Ink API** `androidx.ink:ink-*:1.1.0-alpha03` | `ink-authoring` (live wet ink), `ink-strokes`, `ink-geometry` (erase/select), `ink-brush`, `ink-rendering`, `ink-storage`, `ink-authoring-compose`. |
| Low latency | Ink API's built-in live-authoring path | It sits on the Jetpack low-latency graphics + motion-prediction libraries. Do not hand-roll front-buffer rendering unless Ink API proves insufficient. |
| Local DB | **Room** | Pages, tasks, carry-forward links, metadata. |
| Stroke persistence | `ink-storage` serialization → stored as a blob per page (file on disk, path referenced in Room) | Keep large stroke blobs out of Room rows; store file path. |
| Architecture | MVVM + Repository | ViewModel per screen, single source of truth in the repo. |
| DI | Hilt | |
| Async | Coroutines + Flow | |
| Navigation | Navigation-Compose | |
| PDF export | Android `PdfDocument` or render strokes via Ink rendering to a canvas | For "export a day to PDF". |

**Alpha risk mitigation:** The Ink API is alpha. Isolate all Ink API calls behind an `InkEngine` interface so that if the API breaks or is dropped, the renderer can be swapped for a fallback built on `androidx.graphics:graphics-core` (front-buffer) + `androidx.input:input-motionprediction` without touching the rest of the app. **All ink code goes through this interface. No Ink API types leak into ViewModels or the data layer.**

---

## 4. Core Concepts / Data Model

```
Page        (one per calendar day)
 ├─ date            LocalDate (PK, unique)
 ├─ focusStrokeIds  ink for the "focus" line
 ├─ inkBlobPath     serialized strokes for the whole page (notes/scribbles layer)
 └─ createdAt / updatedAt

Task        (a task line, scoped to a day OR a week)
 ├─ id
 ├─ scope           DAY | WEEK
 ├─ pageDate        nullable LocalDate   (set when scope = DAY)
 ├─ weekId          nullable String      (set when scope = WEEK; ISO year-week, e.g. "2026-W28")
 ├─ rowIndex        ordering within its day/week list (rows are scrollable, unbounded)
 ├─ status          OPEN | DONE | CARRIED
 ├─ inputType       INK | TEXT           (per-task; user chooses)
 ├─ textContent     nullable String      (set when inputType = TEXT)
 ├─ inkBlobPath     nullable             (serialized strokes when inputType = INK)
 ├─ carriedToDate   nullable LocalDate   (set when a task is carried forward)
 └─ createdAt / updatedAt

CarryLink   (audit trail of a deferral)
 ├─ id
 ├─ sourceTaskId
 ├─ sourceScopeKey  (pageDate or weekId of origin)
 └─ targetDate
```

**Task scope.** A task belongs to a specific **day** (`scope = DAY`) or to a **week** (`scope = WEEK`) with no fixed day. Week tasks appear in the weekly view's week section (§5.5) and are not tied to any single daily page. A week task can be promoted into a specific day (carry/assign to a date); a day task can be pushed up to week scope.

**Week identity.** `weekId` uses the ISO-8601 year-week key. Display the week range using the device/locale first-day-of-week (One UI may default to Sunday or Monday — respect the system setting, don't hardcode).

**Dual input.** Every task is either typed (`TEXT`) or handwritten (`INK`) — the user picks per task, for flexibility. Status/checkbox and carry logic work identically regardless of input type. Typed tasks are also searchable later without OCR; ink tasks are not (until optional recognition is added — see §9).

**Layering on a daily page (bottom → top):**
1. Template background (static, drawn, not stored per page — see §6).
2. Notes/scribbles ink layer (free strokes anywhere).
3. Task rows — **scrollable, unbounded list**. Each row: checkbox + status + either a text field (TEXT) or an ink writing lane (INK).

Checkbox and status are always **structured** (tap to toggle done). Content is typed or ink. This hybrid gives trackable/carryable tasks in both modes without forcing transcription of handwriting.

---

## 5. Features by Screen

### 5.1 Today / Daily Page (the main screen)
- Opens on today's date.
- Header: date (auto), a "FOCUS" ink line.
- Task area: **scrollable, unbounded list of rows**. Each row has a tappable checkbox on the left and content that is either:
  - **INK** — a ruled writing lane; write the task with the S Pen.
  - **TEXT** — a typed text field (soft keyboard).
  - A per-row toggle (or "add task" offers both: ✎ write / ⌨ type). User picks per task.
  - Tap circle → toggle `OPEN`/`DONE`. `DONE` renders a strike-through (across ink strokes or across typed text; non-destructive — un-toggling restores).
  - **Done tasks stay on their own day and are never auto-carried to the next day.** They remain visible, struck-through, on the day they were completed.
  - Long-press a row → context menu: **Carry forward…**, **Move to week**, Clear row.
- "Add task" button appends a new row (choose write or type).
- Notes/scribbles band: free-draw ink anywhere (dot-grid background); optional typed sticky-note text boxes.
- **S Pen behaviour:**
  - `TOOL_TYPE_STYLUS` draws.
  - S Pen side-button held → temporary eraser.
  - `TOOL_TYPE_ERASER` (pen flipped) → erase.
  - Finger drag → pan/scroll & page navigation, never draws.
- Undo/redo (per page).

### 5.2 Navigation & View Switching
- Toggle between **Daily** and **Weekly** views (top-level switch).
- Daily: swipe left/right = previous/next day. Date picker to jump anywhere (past/future); missing dates created lazily on first write. "Today" button snaps back.
- Weekly: swipe left/right = previous/next week. Week picker to jump. "This week" button snaps back.

### 5.3 Weekly View
- Shows the 7 days of the selected week at a glance (Mon–Sun or Sun–Sat per locale first-day-of-week).
- Each day cell shows a compact summary: date, open/done task counts, and the focus line if set.
- Tap a day cell → opens that Daily Page (§5.1).
- Header shows the week range and `weekId` (e.g. "7–13 Jul · 2026-W28").

### 5.4 Week Tasks section
- A distinct list within the Weekly View for tasks assigned to the **whole week**, not a specific day (`scope = WEEK`).
- Same behaviour as day tasks: scrollable rows, dual input (write or type), checkbox status, strike-through on done.
- Actions on a week task: **Assign to a day** (moves it to a specific daily page → becomes a DAY task), Clear.
- Actions on a day task (from §5.1): **Move to week** (promotes it to the current week's week-task list).
- Done week tasks stay in the week section struck-through; they do not roll into the next week.

### 5.5 Carry Forward flow
- From a task row: **Carry forward → pick date** (default: tomorrow). Applies to OPEN tasks; done tasks are not carried.
- On confirm:
  - Copy that task (ink strokes **or** text) onto the target page's next row.
  - Set source `status = CARRIED`, render it greyed with a small "→ 12 Jul" tag.
  - Write a `CarryLink` record.
- Week↔day movement (§5.4) reuses this copy/assign machinery.
- Alternative gesture (nice-to-have): lasso-select ink (notes included) via `ink-geometry` → "Send to date".

### 5.6 Backup / Export
- Auto-save continuously (debounced) to local storage.
- Manual **Export day → PDF** (single page) and **Export range → PDF**.
- Local backup/restore of the whole database + stroke blobs (zip).
- Google Drive backup is **optional, later** (see non-goals). Design the backup layer so a Drive target can be added without rework.

### 5.7 Settings
- Pen: colour, base width, pressure sensitivity curve.
- Template selection (see §6).
- Palm-rejection toggle (default on).
- Dark mode.

---

## 6. Templates

Ship 2–3 daily-page backgrounds drawn programmatically (not bitmaps): 
1. **Diary** — focus line, task rows with checkbox anchors, dot-grid notes band (mirror the user's existing paper template).
2. **Blank dot-grid.**
3. **Blank plain.**

Templates are render-time backgrounds tied to a page; they are not stored as strokes. Task-row slot coordinates come from the active template so checkboxes/rows line up.

---

## 7. Non-Functional Requirements

- **Performance:** sustained smooth inking at device refresh rate; no dropped strokes on fast writing. Batch persistence off the UI thread.
- **Data safety:** never lose ink. Write-ahead/debounced autosave; crash-safe. A page must survive force-close.
- **Storage:** stroke blobs on disk, referenced by path; keep Room rows small.
- **Privacy:** all data local. No analytics/telemetry in v1.
- **Accessibility:** respect system font scale for chrome/UI (not the ink itself).

---

## 8. Build Milestones (ship in order; each must run on-device)

| # | Milestone | Definition of done |
|---|---|---|
| M1 | Ink canvas MVP | Draw + erase with S Pen at low latency on one screen; strokes persist across app restart. `InkEngine` interface in place. |
| M2 | Daily pages + navigation | Room-backed Page per date; swipe between days; jump-to-date; lazy page creation. |
| M3 | Task rows (dual input) | Scrollable unbounded rows; add task as **ink or text**; tappable checkboxes; OPEN/DONE toggle; non-destructive strike-through (both input types); undo/redo. Done tasks stay on their day, never auto-carry. |
| M4 | Weekly view + week tasks | Daily/Weekly switch; 7-day week overview with per-day summaries; tap day → daily page; week-scoped task list (dual input); assign week↔day. |
| M5 | Carry forward | Row long-press → carry OPEN task (ink or text) to a date; source marked CARRIED with tag; CarryLink recorded; reuse for week↔day moves. |
| M6 | Templates + focus line | Diary/dot-grid/blank backgrounds; row coordinates driven by template; focus ink line. |
| M7 | Backup/export | Continuous autosave; export day/range to PDF; local zip backup/restore. |
| M8 | Polish | Palm-rejection tuning, pressure curve, pen settings, dark mode, lasso select-and-send. |

Do M1 completely and validate ink feel before anything else. If ink latency/feel is not right, stop and fix it — the rest of the app is worthless without it.

---

## 9. Explicit Non-Goals (v1)

- No multi-user, no cloud sync server, no collaboration.
- No reminders/notification engine. This app is deliberately "dumb paper." Do not add nagging/overdue logic.
- No handwriting OCR / search in v1. (Later enhancement: ML Kit Digital Ink Recognition for optional search — design data model to allow adding a `recognizedText` field per row without migration pain, but do not build it now.)
- No cross-platform (no iOS, no web, no Flutter).
- No Samsung S Pen air-gesture / BLE remote SDK in v1 (only on-screen S Pen via MotionEvent).
- No account system.

---

## 10. Coding Conventions for Claude Code

- Kotlin, idiomatic, coroutines/Flow. Compose for all UI.
- MVVM: no business logic in composables; ViewModels expose `StateFlow`.
- Keep it a single Gradle module until complexity forces a split.
- All Ink API usage behind `InkEngine` (see §3 risk note). No `androidx.ink.*` imports outside the ink package.
- Unit-test the data layer (repository, carry-forward logic, status transitions). Ink rendering can stay manually tested.
- Minimal dependencies. Justify any library not listed in §3 before adding it.
- Prefer clarity over cleverness; this is a solo-maintained app.
- Comment the non-obvious ink/geometry code; the rest should be self-documenting.

## 11. Resolved Decisions
- **Input:** every task is typed **or** handwritten, chosen per task. Both fully supported.
- **Rows:** scrollable and unbounded (no fixed slot count).
- **Done tasks:** stay visible on their own day, struck-through; never auto-carry to the next day/week.
- **Views:** Daily and Weekly. Weekly shows a 7-day overview plus a week-scoped task section.
- **Week tasks:** tasks can be assigned to a whole week (no day) and later assigned to a specific day; day tasks can be promoted to week scope.

## 12. Still Open (pick a sensible default, note it, proceed)
1. Default carry-forward target: always tomorrow, or last-used date?
2. Week start: follow system locale (recommended) — confirm if a fixed Mon start is preferred.
3. On PDF export of a week, include the week-task section as its own page?
