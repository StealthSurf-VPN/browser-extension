# StealthSurf Browser Extension

For full documentation, see [AGENTS.md](../../AGENTS.md) in the project root.

## Quick Commands

```bash
npm install              # Install dependencies
npm run dev:chrome       # Watch mode (Chrome)
npm run dev:firefox      # Watch mode (Firefox)
npm run build:chrome     # Production build (Chrome)
npm run build:firefox    # Production build (Firefox)
npm run build:all        # Build both platforms
npm run format           # Biome formatter
npm run lint             # Biome linter
npm run release          # Full release (build + package)
```

## Key Conventions

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes only
- **Language**: JavaScript (JSX), no TypeScript
- **Comments**: English in code
- **UI strings**: Russian
- **Imports**: Relative paths (extensions don't support `/src/...`)

## Key Files

- `src/background/index.js` — Service worker entry (ensureInit pattern)
- `src/background/proxyManager.js` — Cross-browser proxy abstraction
- `src/background/proxyChrome.js` — PAC script generation + onAuthRequired (retry limit)
- `src/background/proxyFirefox.js` — proxy.onRequest with domain filtering
- `src/background/authManager.js` — PKCE OAuth code exchange + token management
- `src/background/messageHandler.js` — Message dispatcher with sender.id validation
- `src/popup/App.jsx` — Root component with VK UI providers
- `src/popup/pages/MainPage.jsx` — Power toggle, IP badge, config selector, update banner
- `src/popup/pages/ConfigSelectPage.jsx` — Full config list with ping
- `src/popup/pages/LocationSelectPage.jsx` — Location picker with ping
- `src/popup/pages/SettingsPage.jsx` — Profile and settings
- `src/popup/pages/SplitTunnelPage.jsx` — Domain-based split tunneling
- `src/popup/pages/AuthPage.jsx` — PKCE OAuth login
- `src/popup/components/ErrorBoundary.jsx` — Error boundary with key-based remount
- `src/popup/hooks/useProxyConnection.js` — Connect/disconnect with credential validation
- `src/popup/hooks/useProxyList.js` — Data fetching and normalization
- `src/popup/hooks/useLoadResources.js` — Parallel data loading with retry
- `src/popup/hooks/useExtAuth.js` — Auth check via storage listener
- `src/popup/state/atoms.js` — Recoil atoms (extension, proxy, resources, pings)
- `src/api/api.instance.js` — Axios with chrome.storage tokens + refresh timeout
- `src/shared/constants.js` — Message types, storage keys
- `src/shared/updateChecker.js` — GitHub Releases version checker (requires management permission)
- `src/shared/ping.js` — Ping measurement via XHR
- `src/shared/getPingLabel.jsx` — Colored ping label JSX component
- `src/shared/pkce.js` — PKCE challenge/verifier generation
- `vite.config.mjs` — Dual-entry build configuration

## Workflow

### 1. Plan First

- Enter plan mode for any non-trivial task
- If something goes wrong, stop and re-plan

### 2. Verification Before Done

- Never mark a task complete without proving it works
- Run `npm run format` and `npm run build:chrome` after changes
- Verify build completed successfully (exit code 0)

### 3. Cross-Browser Awareness

- Chrome uses PAC script via `chrome.proxy.settings` + `onAuthRequired`
- Firefox uses `browser.proxy.onRequest` with inline auth
- Split tunneling: PAC `FindProxyForURL` (Chrome) vs domain matching in listener (Firefox)
- Always test changes against both `proxyChrome.js` and `proxyFirefox.js`
- Background service worker in Chrome MV3 is ephemeral — persist state in `chrome.storage.local`

### 4. Extension-Specific Constraints

- No `localStorage` in service workers — use `chrome.storage.local` (async)
- No `window` in service workers — use `chrome.runtime.sendMessage`
- No dynamic `import()` in Chrome MV3 service workers — single bundle
- Popup is ephemeral — restore state from background on every open
- `chrome.storage.local` is shared between popup and background

### 5. Security Considerations

- `messageHandler.js` validates `sender.id === chrome.runtime.id` on all messages
- `authHandler` in proxyChrome.js limits retries to 2 per requestId (prevents infinite loop)
- Domain sanitization uses strict whitelist `[a-z0-9.*_-]`
- OAuth uses `authInProgress` lock to prevent concurrent flows
- Token refresh has 10s timeout via `Promise.race`

## Core Principles

- **Simplicity First**: Extension is a focused mini-app for one flow
- **No Laziness**: Find root causes. No temporary fixes
- **Minimal Impact**: Changes should only touch what's necessary
