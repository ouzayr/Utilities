# Deploying the web app to Azure

The web app is a fully static Vite build (`web/dist`) — no server code. You
have two good options; **Static Web Apps** is simpler and has a free tier.

> In both cases, remember to add the final hostname to Firebase →
> Authentication → Settings → **Authorized domains**, or Google sign-in will fail.

---

## Option 1 — Azure Static Web Apps (recommended, free)

### One-time
1. Azure Portal → **Create resource → Static Web App**.
   - Plan: **Free**.
   - Deployment source: **Other** (we deploy from the CLI; you can wire GitHub later).
2. Install the CLI locally: `npm install -g @azure/static-web-apps-cli`.

### Deploy
```bash
cd ToDoDiary/web
cp .env.example .env.local        # fill in your real Firebase values (once)
npm install
npm run build                     # bakes the Firebase config into dist/
npx swa deploy ./dist --env production \
  --deployment-token "<token from Azure portal → your SWA → Manage deployment token>"
```

`staticwebapp.config.json` (already in `web/`) is picked up automatically and
gives SPA fallback routing.

### Or wire it to GitHub (auto-deploy on push)
When creating the Static Web App choose **GitHub** as source:
app location `ToDoDiary/web`, output location `dist`. Azure adds its own
workflow file. Then add your six `VITE_FIREBASE_*` values as **GitHub Actions
secrets** and pass them as `env` in the generated workflow's build step (Vite
reads them at build time; they are public client config, not secrets in the
cryptographic sense).

---

## Option 2 — Azure App Service (Web App)

Use this if you specifically want an `*.azurewebsites.net` App Service.

1. Azure Portal → **Create resource → Web App**.
   - Publish: **Code**, Runtime: **Node 22 LTS**, OS: Linux, plan: B1 or F1.
2. Build locally with your Firebase values:
   ```bash
   cd ToDoDiary/web
   npm install && npm run build
   ```
3. Deploy the `dist/` folder. Easiest is zip deploy:
   ```bash
   cd dist && zip -r ../site.zip . && cd ..
   az webapp deploy --resource-group <rg> --name <app-name> --src-path site.zip --type zip
   ```
4. Configuration → General settings → **Startup command**:
   ```
   pm2 serve /home/site/wwwroot --no-daemon --spa
   ```
   (`--spa` gives index.html fallback routing; pm2 is pre-installed on the
   Node Linux image.)

---

## Updating

Rebuild (`npm run build`) and redeploy the new `dist/`. The Firebase config is
baked in at build time, so a config change also requires a rebuild.

## Custom domain + HTTPS

Both options support custom domains with free managed certificates
(Static Web Apps: Custom domains blade; App Service: Custom domains + App
Service Managed Certificate). Add the custom domain to Firebase authorized
domains too.
