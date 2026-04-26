# Component Patterns

## Popup Structure

The popup is a React app without URL routing. Sizing is platform-conditional:

- **Desktop:** fixed `380×520` (380px width, 520–600px height) — set on `html, body` in `popup.css`.
- **Firefox Android:** fills viewport. `main.jsx` adds `is-mobile` class to `<html>` when UA contains `Android` or `Mobile`. CSS rules under `html.is-mobile` override `width`/`max-width`/`max-height` and scale up the power button (168×168), header, and status text.

Navigation is state-based:

```jsx
// App.jsx
{activePage === "main" && <MainPage />}
{activePage === "configSelect" && <ConfigSelectPage />}
{activePage === "locationSelect" && <LocationSelectPage />}
{activePage === "settings" && <SettingsPage />}
{activePage === "splitTunnel" && <SplitTunnelPage />}
```

## VK UI Usage

Use `@vkontakte/vkui` components for consistency:

```jsx
import { Button, Card, SimpleCell, Header, Placeholder, Spinner, Skeleton } from "@vkontakte/vkui"
import { ConfigProvider, AppRoot } from "@vkontakte/vkui"
```

Platform detection (App.jsx) — macOS/iOS → `"ios"` (SF Pro), else `"android"` (Roboto).

Theme detection via `prefers-color-scheme`.

## Pages

### MainPage

Primary screen: power toggle, connection status with external IP badge (country flag + IP), config selector with expiration and colored ping, update banner (non-store installs).

### ConfigSelectPage

Full config list from all sources. Each card: flag + title (or location fallback) + expiration date + colored ping. Click connects and returns to MainPage.

### LocationSelectPage

Location picker with per-location ping measurement. Selecting a location changes the config's server and auto-reconnects.

### SettingsPage

User profile with ID and balance, "Proxy all traffic" toggle, protocol selector (SOCKS5/HTTP, Firefox only, disabled while connected), useful links (Telegram, docs, status, support), legal information, version display.

### SplitTunnelPage

Domain-based split tunneling with two modes:

- **Exclude**: all traffic proxied except listed domains
- **Include**: only listed domains proxied

Features: SegmentedControl for mode, input with add button, domain list with delete, wildcard support (`*.example.com`), auto-strip protocol from pasted URLs.

### AuthPage

PKCE OAuth login — opens main site for authentication.

## Hooks

### useExtAuth

Manages authentication state. PKCE OAuth flow: generates code_verifier/code_challenge, opens auth URL, monitors callback. Listens to `chrome.storage.onChanged`.

### useProxyList

Fetches and normalizes data from three sources into a flat list:

```javascript
{
  id, title, source: "config" | "paid_option" | "cloud",
  locationId, locationRealId, locationTitle, locationCode, protocol,
  hasProxy: boolean, proxyUrl: string | null,
  expiresAt, isOnline,
  optionId?, serverId?
}
```

**Important**: `locationId` may be a virtual/smart location (no `ping_ip`). Use `locationRealId` for ping measurement.

### useProxyConnection

Connect/disconnect through background:

1. Read protocol preference via `getProxyProtocol()` (SOCKS5 default on Firefox, HTTP on Chrome)
2. If no proxy subconfig → auto-create with selected protocol
3. Parse connection URL → extract credentials
4. Send `PROXY_CONNECT` to background with protocol
5. Background applies proxy settings (Firefox: `type: "socks"` or `type: "http"`, Chrome: always HTTP PAC)

### useLoadResources

Parallel loading of configs, paid options, cloud servers, locations, and profile data.

### useSnackbarHandler

Helper for snackbar notifications via notistack.

## Ping Display

Colored ping measurement using `shared/ping.js` and `shared/getPingLabel.jsx`:

- `measureBest(ping_ip, 3)` — 1 warmup + 3 attempts, returns minimum RTT
- `getPingLabel(ping)` — returns colored JSX `<span>` element or null
- ≤100ms → green (`.ext-text--positive`)
- ≤200ms → orange (`.ext-text--warning`)
- >200ms → red (`.ext-text--negative`)

ConfigSelectPage measures all unique `locationRealId` locations. MainPage measures only the displayed config's location.

## Error Boundary

`src/popup/components/ErrorBoundary.jsx` wraps the app to catch render errors:

- Shows error message with retry button
- Uses key-based remount (`resetKey` counter) to force full re-render on retry

## File Naming

| Type | Pattern | Example |
| --- | --- | --- |
| Pages | `src/popup/pages/{Name}Page.jsx` | `MainPage.jsx` |
| Components | `src/popup/components/{Name}.jsx` | — |
| Hooks | `src/popup/hooks/use{Name}.js` | `useProxyConnection.js` |
| Background | `src/background/{name}.js` | `proxyManager.js` |
| Shared | `src/shared/{name}.js` | `parseConnectionUrl.js` |
