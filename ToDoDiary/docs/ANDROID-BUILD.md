# Building & installing the Android app (Galaxy S25 Ultra)

## Option A — GitHub Actions (no local tools needed) ✅ recommended

Every push touching `ToDoDiary/**` runs the **"ToDoDiary build"** workflow,
which runs the unit tests and produces a **signed release APK**.

1. Make sure you've replaced `android/app/google-services.json` with the real
   one from Firebase (see FIREBASE-SETUP.md §4) and pushed.
2. GitHub → your repo → **Actions** → latest "ToDoDiary build" run →
   **Artifacts** → download **`ToDoDiary-release-apk`**.
3. Unzip it; you get `app-release.apk`.

### Install on the S25 Ultra

1. Copy the APK to the phone (Google Drive, USB, or `adb install app-release.apk`).
2. Open it from **My Files** → allow "Install unknown apps" for My Files when prompted → Install.
3. First launch → **Sign in with Google**.

Because the APK is always signed with the same committed keystore, newer builds
install directly over older ones (no uninstall needed, data kept — and the data
lives in Firestore anyway).

## Option B — Local build with Android Studio

1. Open `ToDoDiary/android` in Android Studio (Ladybug or newer).
2. Let it sync (Android SDK 35 will be fetched automatically).
3. Connect the phone with USB debugging on → **Run**. Or build a release APK:
   `./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`.

## Option C — Local command line

Requires JDK 17+ and the Android SDK (set `ANDROID_HOME`).

```bash
cd ToDoDiary/android
./gradlew testReleaseUnitTest   # data-layer unit tests
./gradlew assembleRelease       # signed with app/release.keystore
```

## Signing

The release keystore is committed at `android/app/release.keystore`
(alias `tododiary`, store/key password `tododiary`). It only exists so your
personal builds and CI builds share one signature — it is **not** a Play Store
upload key. If you ever publish to Play, generate a fresh keystore, move the
passwords into GitHub secrets (`TODODIARY_STORE_PASSWORD`, `TODODIARY_KEY_ALIAS`,
`TODODIARY_KEY_PASSWORD` are already read from the environment by the build),
and update the SHA fingerprints in Firebase.

## S Pen behaviour (how it's wired)

- Stylus (`TOOL_TYPE_STYLUS`) draws; finger scrolls/swipes and never draws
  (toggle "palm rejection" in Settings to allow finger drawing).
- S Pen **side button held** or the pen flipped (`TOOL_TYPE_ERASER`) erases whole
  strokes, as does the toolbar eraser toggle.
- Pressure controls line width (curve adjustable in Settings).
- Wet ink uses Android's motion-prediction library to hide input latency.
