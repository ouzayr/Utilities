# Firebase setup (database + Google authentication)

One Firebase project serves both the Android app and the web app. Everything
here is on the free **Spark** plan.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in with your Google account (ouzayr@gmail.com).
2. **Add project** → name it e.g. `tododiary` → Google Analytics **off** (not needed) → Create.

## 2. Enable Google sign-in

1. In the console: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable.
3. Set the support email → Save.

## 3. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Choose a location close to you (e.g. `europe-west1`) — this cannot be changed later.
3. Start in **production mode**.
4. Open the **Rules** tab and replace the contents with the file
   [`ToDoDiary/firestore.rules`](../firestore.rules) from this repo, then **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

No indexes need to be created — the apps only use single-field and equality-only queries.

## 4. Register the Android app

1. Project overview → **Add app → Android**.
2. Package name: **`com.ouzayr.tododiary`** (must match exactly).
3. Add BOTH SHA fingerprints of the signing key (**required for Google sign-in**).
   The repo's committed release keystore has these fingerprints:

   ```
   SHA-1:   3B:C1:E3:97:A2:14:55:98:3B:4A:5B:AA:07:5F:E7:FD:E5:06:8A:E0
   SHA-256: 81:D0:87:41:CB:8F:21:A6:90:2D:D8:47:41:4B:EF:4D:EF:0E:77:DF:ED:EB:54:B7:6B:51:1F:C4:07:76:3E:79
   ```

   (If you ever regenerate the keystore, re-run
   `keytool -list -v -keystore android/app/release.keystore -alias tododiary -storepass tododiary`
   and update the fingerprints in Firebase → Project settings → Your apps → Android.)
4. **Download `google-services.json`** and replace the placeholder file at
   `ToDoDiary/android/app/google-services.json`.
5. Commit + push (or rebuild locally) so the APK is built with the real config.
   **The committed file is a placeholder — Google sign-in will not work until it is replaced.**

## 5. Register the web app

1. Project overview → **Add app → Web** (`</>` icon). Nickname `tododiary-web`. No hosting.
2. Copy the config values shown (apiKey, authDomain, …) into `ToDoDiary/web/.env.local`
   (copy `.env.example` and fill it in):

   ```
   VITE_FIREBASE_API_KEY=AIza…
   VITE_FIREBASE_AUTH_DOMAIN=tododiary-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tododiary-xxxx
   VITE_FIREBASE_STORAGE_BUCKET=tododiary-xxxx.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
   ```

3. **Authorized domains**: Authentication → Settings → Authorized domains.
   `localhost` and `*.firebaseapp.com` are pre-authorized. **Add your Azure
   hostname** once deployed (e.g. `tododiary.azurestaticapps.net` or
   `tododiary.azurewebsites.net`), otherwise the Google popup will be blocked
   with `auth/unauthorized-domain`.

## 6. Verify

- **Web**: `cd ToDoDiary/web && npm install && npm run dev` → open http://localhost:5173 → Sign in with Google → add a task.
- **Android**: install the APK built *after* step 4 → sign in with the same Google account → the task you added on the web appears on today's page.

## Data stored (per user, private to their account)

```
users/{uid}/pages/{yyyy-MM-dd}   one document per diary day (focus + notes ink)
users/{uid}/tasks/{id}           day- and week-scoped tasks (typed or ink)
users/{uid}/carryLinks/{id}      audit trail of carry-forward moves
```

Firestore is also your backup: reinstalling the app or clearing the browser
loses nothing. Handwriting is stored inline in the documents as compact stroke
JSON (see ARCHITECTURE.md); a very heavily scribbled page is ~100–300 KB,
comfortably under Firestore's 1 MB/document limit, and typical daily usage
stays far below the free tier's 50k reads / 20k writes per day.
