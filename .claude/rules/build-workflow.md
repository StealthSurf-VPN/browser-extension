# Build Workflow

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev:chrome` | Watch mode for Chrome |
| `npm run dev:firefox` | Watch mode for Firefox |
| `npm run build:chrome` | Build for Chrome → `dist/chrome/` |
| `npm run build:firefox` | Build for Firefox (AMO) → `dist/firefox/` |
| `npm run build:firefox:github` | Build for Firefox (GitHub, with `update_url`) → `dist/firefox/` |
| `npm run build:all` | Build both platforms (AMO) |
| `npm run build:all:github` | Build both platforms (GitHub) |
| `npm run format` | Run Biome formatter |
| `npm run lint` | Run Biome linter |
| `npm run lint:firefox` | Auto-rebuilds AMO variant + runs `web-ext lint` |
| `npm run release` | Full release: build + package |
| `npm run pack:zip` | Package as ZIP |
| `npm run pack:crx` | Package as CRX (Chrome) |
| `npm run pack:xpi` | Package as XPI (Firefox) |

## Build Process

Each `build:*` script runs Vite build, then copies static files:

```bash
# What build:chrome does internally:
VITE_TARGET=chrome vite build
cp manifest/manifest.chrome.json dist/chrome/manifest.json
cp -r src/assets/icons dist/chrome/
cp src/callback/callback.html src/callback/callback.js dist/chrome/
```

## When to Run Build

After ANY code changes:

1. Run `npm run format`
2. Run `npm run build:chrome`
3. Verify build completed successfully
4. Fix errors if any
5. Repeat until successful

## Vite Configuration

Dual-entry build:

- `popup`: `src/assets/popup.html` → popup.js + CSS
- `background`: `src/background/index.js` → background.js (single bundle)

Key settings:

- `base: "./"` — relative paths for extension compatibility
- `target: "esnext"` — modern JS for extension environments
- `define: { __BACKEND_URL__ }` — injected at build time from `.env`

## Manifests

- `manifest/manifest.chrome.json` — Chrome Manifest V3 (service_worker)
- `manifest/manifest.firefox.json` — Firefox Manifest V2 (AMO, no `update_url`)
- `manifest/manifest.firefox.github.json` — Firefox Manifest V2 (GitHub, with `update_url`)

Key permissions: `proxy`, `storage`, `webRequest`, `webRequestAuthProvider` (Chrome), `webRequestBlocking` (Firefox), `alarms`, `management`.

## Firefox for Android

Both Firefox manifests declare `gecko_android.strict_min_version = "113.0"` — the Fenix version that opened the extension ecosystem. Test on a real device via:

```bash
npm run build:firefox && npx web-ext run \
  --target=firefox-android \
  --android-device=<adb-serial> \
  --firefox-apk=org.mozilla.fenix \
  --source-dir=dist/firefox
```

`org.mozilla.fenix` = Firefox Nightly (required for unsigned add-ons). USB debugging on, `xpinstall.signatures.required=false` on the device.

## Packaging

`scripts/pack.mjs` handles ZIP, CRX, and XPI:

- ZIP: `dist/chrome/` → `release/stealthsurf-chrome-vX.Y.Z.zip`
- CRX: signed with `key.pem` → `release/stealthsurf-chrome-vX.Y.Z.crx`
- XPI: `dist/firefox/` → `release/stealthsurf-firefox-vX.Y.Z.xpi`

## Firefox Auto-Update

`updates.json` in repo root — add new entries to the end of the `updates` array:

```json
{
  "version": "1.1.0",
  "update_link": "https://github.com/stealthsurf-vpn/browser-extension/releases/download/v1.1.0/stealthsurf-firefox-v1.1.0.xpi"
}
```
