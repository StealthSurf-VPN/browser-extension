# AGENTS.md

Guide for AI assistants working with the StealthSurf Browser Extension codebase.

## Project Overview

Cross-browser extension (Chrome MV3, Firefox MV2) for connecting to proxies via StealthSurf VPN. Displays user's configs, paid options, and cloud server proxies. Supports one-click proxy connection (SOCKS5 on Firefox, HTTP on Chrome), location changes, split tunneling, and auto-update checking.

## Tech Stack

- React 18.3.1, Vite 6.4.1, VK UI 6.7.4, Recoil 0.7.7
- Axios with token refresh via background service worker
- @vkontakte/icons, notistack
- Biome (formatting/linting), @vitejs/plugin-react-swc, Sass

## Conventions

- Formatting: `npm run format` (Biome). Tabs + double quotes; classic JSX runtime
- Comments in code: English only. UI strings: Russian. No TypeScript
- Imports: relative paths (extensions don't support absolute `/src/...`)
- Naming: components PascalCase, utilities camelCase, hooks `use*` prefix

## Project Structure

```text
extension/
├── manifest/
│   ├── manifest.chrome.json         # Chrome Manifest V3
│   ├── manifest.firefox.json        # Firefox Manifest V2 (AMO)
│   └── manifest.firefox.github.json # Firefox Manifest V2 (GitHub, with update_url)
├── src/
│   ├── background/
│   │   ├── index.js                 # Entry: ensureInit + message listener
│   │   ├── proxyManager.js          # Cross-browser proxy abstraction
│   │   ├── proxyChrome.js           # PAC script + onAuthRequired + split tunneling
│   │   ├── proxyFirefox.js          # proxy.onRequest with inline auth + split tunneling
│   │   ├── authManager.js           # Token CRUD + PKCE code exchange + refresh via chrome.alarms
│   │   └── messageHandler.js        # Message routing with sender.id validation
│   ├── popup/
│   │   ├── main.jsx                 # Entry: RecoilRoot + App
│   │   ├── App.jsx                  # VK UI providers, auth guard, page router
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx         # PKCE OAuth login
│   │   │   ├── MainPage.jsx         # Power toggle, IP badge, config selector, update banner
│   │   │   ├── ConfigSelectPage.jsx # Config list with connect buttons and ping
│   │   │   ├── LocationSelectPage.jsx # Location picker with ping measurement
│   │   │   ├── SettingsPage.jsx     # Profile, proxy settings, useful links
│   │   │   ├── FeedbackPage.jsx     # User feedback/idea submission form
│   │   │   └── SplitTunnelPage.jsx  # Split tunneling: domains + IPv4/IPv6/CIDR (exclude/include)
│   │   ├── hooks/
│   │   │   ├── useExtAuth.js        # Auth check via storage listener
│   │   │   ├── useProxyList.js      # Fetch + normalize configs from all sources
│   │   │   ├── useProxyConnection.js # connect/disconnect/restore via background
│   │   │   ├── useLoadResources.js  # Parallel data loading with retry
│   │   │   ├── useSplitTunnelSync.js # Account sync state machine (pull-on-mount, debounced push)
│   │   │   └── useSnackbarHandler.js # Snackbar helper
│   │   ├── components/
│   │   │   ├── ErrorBoundary.jsx    # Error boundary with key-based remount
│   │   │   └── MainPageSkeleton.jsx # Loading skeleton for popup initial load
│   │   └── state/
│   │       ├── atoms.js             # extensionAtom, proxyAtom, resourcesAtom, pingsAtom
│   │       └── selectors.js         # Read/write selectors
│   ├── callback/
│   │   ├── callback.html            # OAuth callback page — Firefox code capture
│   │   └── callback.js              # OAuth callback script — extracts code, sends to background
│   ├── api/
│   │   ├── api.instance.js          # Axios with chrome.storage.local tokens
│   │   └── routes/
│   │       ├── route.configs.js     # getConfigs, getSubconfig, createSubconfig, changeLocation
│   │       ├── route.paid-options.js # getPaidOptions, subconfigs, settings
│   │       ├── route.cloud-servers.js # getCloudServers
│   │       ├── route.proxies.js     # getCloudServerProxies, createCloudServerProxy
│   │       ├── route.locations.js   # getLocations
│   │       ├── route.profile.js     # getProfile
│   │       ├── route.profile-extension.js # split-tunnel account sync (GET/PUT)
│   │       └── route.feedback.js    # sendFeedback (POST /feedback)
│   ├── shared/
│   │   ├── constants.js             # MSG types, STORAGE_KEYS, CACHE_TTL_MS
│   │   ├── parseConnectionUrl.js    # protocol://user:pass@host:port → object
│   │   ├── getCurrentTimestamp.js   # Unix timestamp in seconds
│   │   ├── ping.js                  # measureBest via XHR to location ping_ip
│   │   ├── getPingLabel.jsx         # Colored ping label component (JSX)
│   │   ├── localizeDate.js          # Unix timestamp → Russian locale date string
│   │   ├── countryFlag.jsx          # Country code → CDN flag <img> (__CDN_DOMAIN__), 🌐 fallback
│   │   ├── ipUtils.js               # IPv4/IPv6/CIDR parsing + matching (popup + Firefox)
│   │   ├── pacIpHelpers.js          # ES5 PAC-safe IP helpers (inlined into PAC via ?raw)
│   │   ├── pkce.js                  # PKCE code_verifier/code_challenge generation
│   │   └── updateChecker.js         # GitHub Releases version checker (non-store)
│   └── assets/
│       ├── popup.html               # Popup HTML shell
│       ├── popup.css                # Extension styles (380×520px popup)
│       └── icons/                   # 16, 32, 48, 128px
├── scripts/
│   └── pack.mjs                     # ZIP, CRX, XPI packaging
├── updates.json                     # Firefox auto-update manifest
├── vite.config.mjs                  # Dual-entry build (popup + background)
├── package.json
├── biome.json
├── .env                              # Local env (VITE_BACKEND_URL/CONSOLE_URL/CDN_DOMAIN)
└── .env.example                      # Template for required env vars
```

## Architecture

### Background Service Worker

Manages proxy connections and auth tokens. Persists state in `chrome.storage.local` (Chrome MV3 kills workers after ~30s idle).

**Initialization** (`index.js`):

- `ensureInit()` — lazy singleton that initializes auth + proxy managers
- Called eagerly at module level and before every message handler
- On failure: resets promise so next call retries (no stale rejected promise)

**Security**:

- `messageHandler.js` validates `sender.id === chrome.runtime.id` on every message
- `AUTH_FIREFOX_CODE` additionally validates sender URL matches `callback.html`
- `PROXY_CONNECT` validates credential types (host, port required; user, pass must be strings)

**Message protocol** (popup → background via `chrome.runtime.sendMessage`):

| Message Type | Purpose | Response |
| --- | --- | --- |
| `PROXY_CONNECT` | Apply proxy with credentials | `{ success }` |
| `PROXY_DISCONNECT` | Clear proxy settings | `{ success }` |
| `PROXY_STATUS` | Get connection state | `{ connected, configMeta }` |
| `AUTH_LOGIN` | Initiate PKCE OAuth | `{ success }` |
| `AUTH_GET_TOKENS` | Read tokens from storage | `{ accessToken, refreshToken }` |
| `AUTH_SET_TOKENS` | Write tokens to storage | `{ success }` |
| `AUTH_CLEAR` | Clear tokens + disconnect | `{ success }` |
| `AUTH_REFRESH` | Refresh access token | `{ token }` |
| `AUTH_FIREFOX_CODE` | Complete Firefox OAuth (code exchange) | `{ success }` |
| `UPDATE_PROXY_SETTINGS` | Reapply proxy with current settings | `{ success }` |
| `UPDATE_BADGE` | Update extension badge text | `{ success }` |

### Cross-Browser Proxy

| Browser | Proxy API | Auth | Split Tunneling |
| --- | --- | --- | --- |
| Chrome | PAC script via `chrome.proxy.settings` | `onAuthRequired` listener (retry limit: 2 per requestId) | PAC `FindProxyForURL` logic |
| Firefox | `browser.proxy.onRequest` listener | Inline in return value | Domain matching in listener |

**Protocol support**: SOCKS5 (Firefox, default) and HTTP (Chrome-only, or user choice on Firefox). Chrome cannot support authenticated SOCKS5 due to extension API limitations (`onAuthRequired` only handles HTTP 407). Protocol preference stored in `chrome.storage.local` (`proxy_protocol` key).

**Chrome PAC script** (`proxyChrome.js`):

- `buildPacScript(host, port, internalHosts, mode, domains)` generates `FindProxyForURL`
- Internal hosts (API/console) always go DIRECT
- `exclude` mode: listed domains go DIRECT
- `include` mode: only listed domains go through proxy
- Wildcard support: `*.example.com` → `dnsDomainIs()`
- Domain sanitization: `[a-z0-9.*_-]` whitelist (allows underscores for `_dmarc.*` etc.)
- `authHandler` has retry limit (2 per requestId via `authRetries` Map, capped at 1000 entries)

**Firefox** (`proxyFirefox.js`):

- `buildProxyResult()` — returns `{ type: "socks", proxyDNS: true }` for SOCKS5 or `{ type: "http", proxyAuthorizationHeader }` for HTTP
- `matchesDomain(hostname, pattern)` helper for domain matching
- `proxyRequestListener` checks split tunnel rules before routing
- `reapplyFirefox()` restores credentials and protocol from storage if in-memory state lost

### Split Tunneling

Stored in `chrome.storage.local`:

| Key | Type | Default |
| --- | --- | --- |
| `split_tunnel_mode` | `"exclude"` \| `"include"` | `"exclude"` |
| `split_tunnel_domains` | `string[]` | `[]` |

Rules cover domains (wildcards via `*.example.com`), IPv4, IPv6, and CIDR ranges (parsed/matched in `shared/ipUtils.js`; Chrome PAC uses ES5-safe `shared/pacIpHelpers.js`). Applied on connect and on `MSG.UPDATE_PROXY_SETTINGS`. Both proxy implementations read settings from storage.

**Account sync** — `useSplitTunnelSync` pulls rules on mount and pushes (debounced 500ms) on edit via `route.profile-extension.js` (`GET/PUT /profile/extension/split-tunnel`). Bookkeeping keys: `sync_routing` (enabled toggle), `sync_last_synced_at` (server `updated_at`), `sync_dirty` (pending local edits).

### Popup

State-based navigation (Recoil atom), not URL router:

```text
activePage: "main" | "configSelect" | "locationSelect" | "settings" | "splitTunnel" | "feedback"
```

**MainPage** — power toggle, connection status with IP badge (external IP + country flag), config selector with ping, update banner.

**ConfigSelectPage** — all configs from all sources with per-location ping.

**LocationSelectPage** — location picker with ping measurement.

**SettingsPage** — user profile, proxy settings toggle, protocol selector (SOCKS5/HTTP, Firefox only, disabled while connected), useful links, legal info, feedback entry.

**SplitTunnelPage** — rule editor with exclude/include mode switcher. Supports domains with wildcards (`*.example.com`), IPv4/IPv6/CIDR, `.txt` import/export, and account sync. Auto-strips protocols from pasted URLs.

**FeedbackPage** — feedback/idea submission form (`POST /feedback`, 1–4000 chars).

### Data Flow

1. Popup opens → `useExtAuth` checks tokens via `chrome.storage.onChanged` listener
2. If authenticated → `useLoadResources` fetches configs/options/servers in parallel (with retry + 1s backoff)
3. `useProxyList` normalizes into flat list with unified structure
4. User clicks Connect → `useProxyConnection.connect()`:
   - Auto-creates proxy subconfig if missing (validates credentials after parse)
   - Sends credentials with protocol to background
   - Background applies proxy via PAC script or onRequest listener

### Normalized Item Structure

```js
{
  id,                  // Config/proxy ID
  title,               // Config title (null → UI falls back to location title)
  source,              // "config" | "paid_option" | "cloud"
  locationId,          // Virtual/smart location ID
  locationRealId,      // Physical server location ID (for ping)
  locationTitle,       // Location display name
  protocol,            // Connection protocol ("socks5" or "http")
  hasProxy,            // Whether proxy subconfig exists
  proxyUrl,            // protocol://user:pass@host:port (null if not yet created)
  expiresAt,           // Expiration Unix timestamp (seconds)
  isOnline,            // Server online status
  optionId?,           // Paid option ID (if source = "paid_option")
  serverId?,           // Cloud server ID (if source = "cloud")
}
```

**Important**: `locationId` may point to a virtual/smart location (no `ping_ip`). Always use `locationRealId` for ping measurement.

### Ping Measurement

Via XHR to `location.ping_ip` (`shared/ping.js`):

- `measureBest(ping_ip, 3)` — 1 warmup + 3 attempts, returns minimum RTT
- `getPingLabel(ping)` — returns colored JSX `<span>` element
- Colored display: ≤100ms green, ≤200ms orange, >200ms red
- CSS classes: `.ext-text--positive`, `.ext-text--warning`, `.ext-text--negative`

### Update Checker

`shared/updateChecker.js` — checks GitHub Releases for newer versions:

- Requires `management` permission in manifests
- Skips store installs (`chrome.management.getSelf().installType === "normal"`)
- Compares semantic versions
- 30-minute cache in `chrome.storage.local` (key: `STORAGE_KEYS.UPDATE_CHECK_CACHE`)
- Returns `{ version, url }` or `null`

MainPage shows update banner when a new version is available.

Firefox GitHub builds (`manifest.firefox.github.json`) have `update_url` pointing to `updates.json` for native auto-update. AMO builds (`manifest.firefox.json`) do not include `update_url`.

### Auth Flow (PKCE)

1. User clicks "Login" → background generates PKCE code_verifier + code_challenge (SHA-256)
2. Opens `__CONSOLE_URL__/auth/connect?client_id=...&code_challenge=...&code_challenge_method=S256&redirect_uri=...`
3. User authenticates on main site → site redirects to `redirect_uri?code=...`
4. Token capture:
   - Chrome: background monitors tab URL via `chrome.tabs.onUpdated`, detects redirect, exchanges code for tokens via `POST __BACKEND_URL__/auth/connect/token`
   - Firefox: `callback.html` extracts code from URL, sends `AUTH_FIREFOX_CODE` to background, background exchanges code for tokens
5. Tokens saved to `chrome.storage.local`
6. Popup detects via `chrome.storage.onChanged`
7. `authInProgress` lock prevents concurrent OAuth flows (released after await)
8. Chrome OAuth has 5-minute timeout; stale OAuth state cleaned up in `completeFirefoxOAuth` via try/finally

## API Layer

- `NETWORK` (`api/api.instance.js`): Axios with `chrome.storage.local` tokens
- Token refresh delegated to background via `MSG.AUTH_REFRESH` with 10s timeout (`Promise.race`)
- Backend URL normalized: `__BACKEND_URL__.replace(/\/+$/, "") + "/"` in authManager.js raw `fetch()` calls
- Response format: `{ status: true/false, data/errorCode/message }`

## Proxy Sources

| Source | List API | Create proxy subconfig | Change Location |
| --- | --- | --- | --- |
| Configs | `GET /configs` | `POST /configs/{id}/subconfig` | `PATCH /configs/{id}/settings` |
| Paid options | `GET /paid-options` | `POST /paid-options/{oid}/configs/{cid}/subconfig` | `PATCH /paid-options/{oid}/configs/{cid}/settings` |
| Cloud servers | `GET /cloud-servers` + proxies | `POST /cloud-servers/{sid}/proxies` | Not available (fixed) |

## Build

```bash
npm install
npm run format
npm run lint                  # Biome lint
npm run build:chrome          # → dist/chrome/
npm run build:firefox         # → dist/firefox/ (AMO variant)
npm run build:firefox:github  # → dist/firefox/ (GitHub variant, with update_url)
npm run build:all             # Both platforms (AMO)
npm run build:all:github      # Both platforms (GitHub)
npm run lint:firefox          # Rebuild AMO Firefox + web-ext lint
npm run pack:all              # Package ZIP + CRX + XPI
npm run release:store         # build:all + pack:all (stores AMO/CWS)
npm run release:github        # build:all:github + pack:all (GitHub)
```

**Environment** — Vite reads `.env` (template: `.env.example`). Required vars, build throws if missing: `VITE_BACKEND_URL`, `VITE_CONSOLE_URL`, `VITE_CDN_DOMAIN`. Injected as defines: `__BACKEND_URL__`, `__CONSOLE_URL__`, `__CDN_DOMAIN__`, and `__IS_FIREFOX__` (from `VITE_TARGET`).

## State Persistence

All persistent state in `chrome.storage.local`:

| Key | Content |
| --- | --- |
| `access_token` | `{ token, expires_at }` |
| `refresh_token` | `{ token, expires_at }` |
| `proxy_state` | `{ connected, host, port, user, pass, protocol }` |
| `connected_config` | `{ id, title, source, locationId, locationTitle, locationCode, optionId?, serverId? }` |
| `proxy_all_traffic` | Boolean — bypass internal hosts |
| `split_tunnel_mode` | `"exclude"` or `"include"` |
| `split_tunnel_domains` | `string[]` of domain patterns |
| `proxy_list_cache` | Cached config list |
| `proxy_list_cache_time` | Cache timestamp |
| `update_check_cache` | `{ timestamp, result }` |
| `proxy_protocol` | `"socks5"` or `"http"` (Firefox preference) |
| `oauth_code_verifier` | PKCE code_verifier (Firefox, temporary) |
| `oauth_redirect_uri` | OAuth redirect URI (Firefox, temporary) |
| `selected_config` | Last selected config `{ id, source }` (popup state persistence) |
| `sync_routing` | Boolean — account sync enabled (default true) |
| `sync_last_synced_at` | Server `updated_at` of last successful split-tunnel sync |
| `sync_dirty` | Boolean — local split-tunnel edits pending push |
