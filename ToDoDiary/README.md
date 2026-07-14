# ToDoDiary 🖋️

A paper-style daily diary that keeps your handwriting as ink.

- **Android app** (Kotlin + Jetpack Compose) for the Galaxy S25 Ultra with S Pen: write tasks and notes by hand, cross them out to complete, carry them forward to another day — exactly like a paper diary. Finger scrolls, pen writes, palm never draws.
- **Web companion** (React + Vite) for your laptop: full typed-task management (add / complete / carry-forward / weekly planning) plus faithful read-only rendering of everything you wrote in ink on the phone.
- **Google Sign-In** on both; **Cloud Firestore** stores all data (offline cache on the phone, live sync everywhere).

## Repository layout

```
ToDoDiary/
├── android/          Android app (open in Android Studio, or build via Gradle/CI)
├── web/              React web app (npm install && npm run dev)
├── docs/
│   ├── FIREBASE-SETUP.md   ← start here: create the Firebase project + database
│   ├── ANDROID-BUILD.md    ← get the APK (CI artifact or local build) onto your S25 Ultra
│   ├── AZURE-DEPLOY.md     ← host the web app on Azure
│   └── ARCHITECTURE.md     ← data model, portable ink format, design decisions
├── firestore.rules   Security rules to paste into the Firebase console
└── CLAUDE.md         Original product spec (+ addendum for the cloud/web evolution)
```

## Quick start (one-time setup, ~20 minutes)

1. **Firebase** — follow [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md): create a free Firebase project, enable Google sign-in and Firestore, download `google-services.json` into `android/app/`, and put the web config into `web/.env.local`.
2. **APK** — follow [docs/ANDROID-BUILD.md](docs/ANDROID-BUILD.md): every push to this repo builds a signed APK in GitHub Actions (workflow "ToDoDiary build"); download the `ToDoDiary-release-apk` artifact and install it on the phone. (You must rebuild after adding your real `google-services.json` — the committed one is a placeholder.)
3. **Web** — `cd web && npm install && npm run dev` for local use, or follow [docs/AZURE-DEPLOY.md](docs/AZURE-DEPLOY.md) to host it on Azure.

## Everyday use

| On the phone | On the laptop |
|---|---|
| Write tasks with the S Pen (or type them) | Add and edit typed tasks |
| Tap the circle to complete (strike-through) | Same |
| Long-menu ⋮ → carry forward / move to week | Same |
| Freeform notes/scribbles per day | Rendered read-only |
| Daily ↔ weekly views, swipe between days | Daily ↔ weekly views |
| Export day/week to PDF | — |

Data syncs both ways through Firestore in near-real-time. The phone works fully offline and syncs when back online.
