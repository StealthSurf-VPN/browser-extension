# StealthSurf Browser Extension

Cross-browser extension for connecting to proxies via [StealthSurf VPN](https://stealthsurf.space).

## Features

- One-click proxy connection with auto-configuration (SOCKS5 / HTTP)
- All service types: configs, paid options, cloud servers
- Split tunneling — route only selected sites through proxy (or exclude specific sites)
- Location switching with real-time ping measurement
- External IP detection with country flag badge
- Auto-update checker for non-store installs (GitHub Releases)
- Auto-restore connection after browser restart
- PKCE OAuth authentication with code exchange

## Supported Browsers

| Browser | Manifest | Proxy API | Status |
| ------- | -------- | --------- | ------ |
| Chrome | V3 | PAC script + `onAuthRequired` (HTTP only) | ✅ |
| Firefox | V2 | `proxy.onRequest` listener (SOCKS5 + HTTP) | ✅ |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
# Watch mode
npm run dev:chrome
npm run dev:firefox
```

### Build

```bash
# Single platform
npm run build:chrome
npm run build:firefox

# Both platforms
npm run build:all
```

### Load in Browser

**Chrome**: `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/chrome/`

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/firefox/manifest.json`

## Commands

| Command | Description |
| ------- | ----------- |
| `npm install` | Install dependencies |
| `npm run dev:chrome` | Watch mode for Chrome |
| `npm run dev:firefox` | Watch mode for Firefox |
| `npm run build:chrome` | Production build → `dist/chrome/` |
| `npm run build:firefox` | Production build → `dist/firefox/` |
| `npm run build:all` | Build both platforms |
| `npm run format` | Biome formatter |
| `npm run lint` | Biome linter |
| `npm run release` | Full release (build + package) |
| `npm run pack:zip` | Package as ZIP |
| `npm run pack:crx` | Package as CRX (Chrome) |
| `npm run pack:xpi` | Package as XPI (Firefox) |

## Architecture

### Background (Service Worker)

Manages proxy connections and auth tokens. State persists in `chrome.storage.local` to survive service worker restarts (Chrome MV3).

- **index.js** — entry point with `ensureInit()` pattern (retryable initialization)
- **proxyManager.js** — cross-browser proxy abstraction
- **proxyChrome.js** — PAC script generation + `onAuthRequired` with retry limit (2 per requestId)
- **proxyFirefox.js** — `browser.proxy.onRequest` with inline credentials (SOCKS5 + HTTP)
- **authManager.js** — PKCE OAuth with code exchange + auto-refresh via `chrome.alarms`
- **messageHandler.js** — message routing popup ↔ background with `sender.id` validation

### Popup (React)

Compact React app (380×520px) with VK UI. State-based navigation via Recoil.

| Page | Description |
| ---- | ----------- |
| MainPage | Power toggle, connection status, IP badge, config selector, update banner |
| ConfigSelectPage | All configs with connect buttons and per-location ping |
| LocationSelectPage | Location picker with ping measurement |
| SettingsPage | Profile, proxy settings, protocol selector (Firefox), useful links |
| SplitTunnelPage | Domain-based split tunneling (exclude/include modes) |
| AuthPage | PKCE OAuth login via StealthSurf site |

### Split Tunneling

Two modes for routing traffic:

- **Exclude** — all traffic through proxy, except listed domains
- **Include** — only listed domains through proxy, everything else direct

Supports wildcard domains (`*.example.com`) and underscored domains (`_dmarc.example.com`). Applied via PAC script (Chrome) or `onRequest` filtering (Firefox).

### Auto-Update (Non-Store Installs)

For installs outside Chrome Web Store / Firefox AMO:

- Checks [GitHub Releases](https://github.com/stealthsurf-vpn/browser-extension/releases) for newer versions
- Requires `management` permission to detect install type
- Shows an update banner on the main page
- Firefox GitHub builds also support native auto-update via `update_url` in `manifest.firefox.github.json`

### Authentication (PKCE)

1. User clicks "Login" → extension generates PKCE code_verifier + code_challenge (SHA-256)
2. Opens `__CONSOLE_URL__/auth/connect` with `client_id`, `code_challenge`, `code_challenge_method=S256`, `redirect_uri`
3. User authenticates → site redirects to extension with authorization `code`
4. Chrome: background monitors tab URL via `tabs.onUpdated`, detects redirect, exchanges code
5. Firefox: `callback.html` extracts code, sends to background via `AUTH_FIREFOX_CODE`
6. Background exchanges code for tokens via `POST /auth/connect/token`
7. Tokens stored in `chrome.storage.local`, popup detects via `storage.onChanged`

### Proxy Connection

1. User clicks "Connect" on a config
2. Proxy subconfig auto-created if missing (SOCKS5 on Firefox, HTTP on Chrome)
3. Credentials parsed from connection URL `protocol://user:pass@host:port`
   - Firefox: `type: "socks"` with `proxyDNS: true` for SOCKS5, `type: "http"` for HTTP
   - Chrome: always `PROXY host:port` via PAC script (HTTP only, no SOCKS5 auth support)
4. Background applies proxy via PAC script (Chrome) or `onRequest` listener (Firefox)
5. Extension badge shows country code of exit IP

## Project Structure

```text
extension/
├── manifest/
│   ├── manifest.chrome.json         # Chrome Manifest V3
│   ├── manifest.firefox.json        # Firefox Manifest V2 (AMO)
│   └── manifest.firefox.github.json # Firefox Manifest V2 (GitHub, with update_url)
├── src/
│   ├── background/                  # Service worker
│   │   ├── index.js                 # Entry point (ensureInit + message listener)
│   │   ├── proxyManager.js          # Cross-browser abstraction
│   │   ├── proxyChrome.js           # PAC script + onAuthRequired
│   │   ├── proxyFirefox.js          # proxy.onRequest listener
│   │   ├── authManager.js           # PKCE OAuth + token management
│   │   └── messageHandler.js        # Message router (sender validated)
│   ├── popup/
│   │   ├── main.jsx                 # React entry
│   │   ├── App.jsx                  # VK UI providers + routing
│   │   ├── pages/                   # UI pages
│   │   ├── components/              # ErrorBoundary
│   │   ├── hooks/                   # Custom hooks
│   │   └── state/                   # Recoil atoms/selectors
│   ├── api/                         # Axios + API routes
│   ├── shared/                      # Utilities (ping, PKCE, updateChecker, etc.)
│   ├── callback/                    # OAuth callback (Firefox)
│   └── assets/                      # HTML, CSS, icons
├── scripts/                         # Build & packaging scripts
├── updates.json                     # Firefox auto-update manifest
├── vite.config.mjs
├── package.json
└── biome.json
```

## Tech Stack

- **React** 18 + **Recoil** — UI and state management
- **VK UI** — component library
- **Axios** — HTTP client with token refresh (10s timeout via `Promise.race`)
- **Vite** — dual-entry build (popup + background)
- **Biome** — formatting and linting

## Distribution

| Channel | Format | Auto-Update |
| ------- | ------ | ----------- |
| Chrome Web Store | CRX | ✅ (Store) |
| Firefox AMO | XPI | ✅ (Store) |
| GitHub Releases | ZIP / CRX / XPI | ✅ (In-app checker + Firefox `update_url`) |

## License

MIT
