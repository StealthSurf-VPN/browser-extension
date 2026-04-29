# StealthSurf Browser Extension

For full documentation, see [AGENTS.md](../../AGENTS.md) in the project root.

## Quick Commands

```bash
npm install              # Install dependencies
npm run dev:chrome       # Watch mode (Chrome)
npm run dev:firefox      # Watch mode (Firefox)
npm run build:chrome          # Production build (Chrome)
npm run build:firefox         # Production build (Firefox, AMO)
npm run build:firefox:github  # Production build (Firefox, GitHub)
npm run build:all             # Build both platforms (AMO)
npm run build:all:github      # Build both platforms (GitHub)
npm run format           # Biome formatter
npm run lint             # Biome linter
npm run lint:firefox     # web-ext lint on AMO Firefox build (auto-rebuilds)
npm run release:github   # Full release for GitHub (build:all:github + pack:all)
npm run release:store    # Full release for stores AMO/CWS (build:all + pack:all)
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
- `src/background/proxyFirefox.js` — proxy.onRequest with domain filtering (SOCKS5 + HTTP via `buildProxyResult`)
- `src/background/authManager.js` — PKCE OAuth code exchange + token management
- `src/background/messageHandler.js` — Message dispatcher with sender.id validation
- `src/popup/App.jsx` — Root component with VK UI providers
- `src/popup/pages/MainPage.jsx` — Power toggle, IP badge, config selector, update banner
- `src/popup/pages/ConfigSelectPage.jsx` — Full config list with ping
- `src/popup/pages/LocationSelectPage.jsx` — Location picker with ping
- `src/popup/pages/SettingsPage.jsx` — Profile, settings, protocol selector (SOCKS5/HTTP, Firefox only)
- `src/popup/pages/SplitTunnelPage.jsx` — Split tunneling: domains, IPv4/IPv6/CIDR, .txt import/export, account sync
- `src/popup/pages/AuthPage.jsx` — PKCE OAuth login
- `src/popup/components/ErrorBoundary.jsx` — Error boundary with key-based remount
- `src/popup/hooks/useProxyConnection.js` — Connect/disconnect with credential validation + protocol from storage
- `src/popup/hooks/useProxyList.js` — Data fetching and normalization
- `src/popup/hooks/useLoadResources.js` — Parallel data loading with retry
- `src/popup/hooks/useExtAuth.js` — Auth check via storage listener
- `src/popup/hooks/useSplitTunnelSync.js` — Sync state machine (pull-on-mount, debounced push-on-edit)
- `src/popup/state/atoms.js` — Recoil atoms (extension, proxy, resources, pings)
- `src/api/api.instance.js` — Axios with chrome.storage tokens + refresh timeout
- `src/api/routes/route.profile-extension.js` — Account sync endpoints (GET/PUT /profile/extension/split-tunnel)
- `src/shared/constants.js` — Message types, storage keys
- `src/shared/ipUtils.js` — IPv4/IPv6/CIDR parsing + matching (popup + Firefox listener)
- `src/shared/pacIpHelpers.js` — ES5 PAC-safe IP helpers (inlined into PAC via Vite `?raw`)
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

- Chrome uses PAC script via `chrome.proxy.settings` + `onAuthRequired` (HTTP only)
- Firefox uses `browser.proxy.onRequest` with inline auth (SOCKS5 default, HTTP optional)
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
- Rule sanitization is per-kind: `sanitizeDomain` (whitelist), `sanitizeIpv4` (regex), `sanitizePrefix` (range). IPv6 entries emitted as integer arrays — zero injection surface.
- OAuth uses `authInProgress` lock to prevent concurrent flows
- Token refresh has 10s timeout via `Promise.race`

## Core Principles

- **Simplicity First**: Extension is a focused mini-app for one flow
- **No Laziness**: Find root causes. No temporary fixes
- **Minimal Impact**: Changes should only touch what's necessary
