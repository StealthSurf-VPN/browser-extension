# Extension Architecture

## Background ↔ Popup Communication

All communication uses `chrome.runtime.sendMessage`. Background validates `sender.id === chrome.runtime.id` on every message.

### Sending messages from popup

```javascript
const response = await chrome.runtime.sendMessage({
  type: MSG.PROXY_CONNECT,
  credentials: { host, port, user, pass, protocol },
  configMeta: { id, title, source, locationCode },
})
```

### Handling messages in background

Messages routed in `src/background/messageHandler.js`. Each handler is async and returns a response.

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ensureInit()
    .then(() => handleMessage(message, sender, sendResponse))
    .catch((err) => sendResponse({ error: err.message }))
  return true // keep channel open for async
})
```

### Message Types

Defined in `src/shared/constants.js`:

| Type | Direction | Purpose |
| --- | --- | --- |
| `PROXY_CONNECT` | popup → bg | Apply proxy (credentials validated) |
| `PROXY_DISCONNECT` | popup → bg | Clear proxy settings |
| `PROXY_STATUS` | popup → bg | Query connection state |
| `AUTH_LOGIN` | popup → bg | Initiate PKCE OAuth (authInProgress lock) |
| `AUTH_GET_TOKENS` | popup → bg | Read tokens |
| `AUTH_SET_TOKENS` | popup → bg | Write tokens |
| `AUTH_CLEAR` | popup → bg | Logout + disconnect |
| `AUTH_REFRESH` | popup → bg | Refresh access token |
| `AUTH_FIREFOX_CODE` | callback → bg | Exchange auth code for tokens (sender URL validated) |
| `UPDATE_PROXY_SETTINGS` | popup → bg | Reapply proxy (split tunnel/settings change) |
| `UPDATE_BADGE` | popup → bg | Update extension badge text |

## Proxy Implementation

### Chrome (`proxyChrome.js`)

Uses PAC script for split tunneling and protocol support:

```javascript
// Connect — generates PAC script
chrome.proxy.settings.set({
  value: {
    mode: "pac_script",
    pacScript: { data: buildPacScript(host, port, internalHosts, mode, domains, protocol) },
  },
  scope: "regular",
})

// Auth handler with retry limit (2 per requestId, capped at 1000 entries)
chrome.webRequest.onAuthRequired.addListener(handler, { urls: ["<all_urls>"] }, ["blocking"])

// Disconnect
chrome.proxy.settings.clear({ scope: "regular" })
```

`buildPacScript()` generates `FindProxyForURL` with:

- `PROXY host:port` (HTTP)
- Internal hosts (API/console) always DIRECT
- `exclude` mode: listed domains DIRECT, rest proxied
- `include` mode: listed domains proxied, rest DIRECT
- Wildcard support via `dnsDomainIs()`
- Domain sanitization: `[a-z0-9.*_-]` whitelist (includes underscores)

### Firefox (`proxyFirefox.js`)

```javascript
// Connect (listener-based, auth inline)
browser.proxy.onRequest.addListener(proxyRequestListener, { urls: ["<all_urls>"] })

// proxyRequestListener checks:
// 1. Internal hosts → DIRECT
// 2. Split tunnel domains → DIRECT or PROXY based on mode
// 3. Default → PROXY

// Return value:
{ type: "http", host, port, username, password }
```

`matchesDomain(hostname, pattern)` handles wildcards. `reapplyFirefox()` restores credentials from storage if in-memory state lost.

## Split Tunneling

Two modes stored in `chrome.storage.local`:

- `split_tunnel_mode`: `"exclude"` (default) or `"include"`
- `split_tunnel_domains`: `string[]` of domain patterns

**Exclude**: proxy everything except listed domains (e.g., bank, government sites)
**Include**: proxy only listed domains, everything else direct

Wildcards: `*.example.com` matches `example.com` and all subdomains.

Applied via `MSG.UPDATE_PROXY_SETTINGS` when settings change.

## Service Worker Lifecycle (Chrome MV3)

- Killed after ~30s of inactivity
- On wake-up, `ensureInit()` initializes auth + proxy managers (retries on failure)
- `initProxyManager()` restores state from `chrome.storage.local` (including protocol)
- `onAuthRequired` listener re-registered after restart
- `chrome.alarms` for periodic token refresh (every 5 min)

## State Persistence

All persistent state in `chrome.storage.local`:

| Key | Content |
| --- | --- |
| `access_token` | `{ token, expires_at }` |
| `refresh_token` | `{ token, expires_at }` |
| `proxy_state` | `{ connected, host, port, user, pass, protocol }` |
| `connected_config` | `{ id, title, source, locationId, locationCode }` |
| `proxy_all_traffic` | Boolean — bypass internal hosts |
| `split_tunnel_mode` | `"exclude"` or `"include"` |
| `split_tunnel_domains` | `string[]` |
| `proxy_list_cache` | Cached config list |
| `proxy_list_cache_time` | Cache timestamp |
| `update_check_cache` | `{ timestamp, result }` |
| `oauth_code_verifier` | PKCE code_verifier (Firefox, temporary) |
| `oauth_redirect_uri` | OAuth redirect URI (Firefox, temporary) |

## Popup State

Recoil for in-memory state. On every popup open, state restored from background via `PROXY_STATUS` and `AUTH_GET_TOKENS`.

Navigation is state-based:

```text
activePage: "main" | "configSelect" | "locationSelect" | "settings" | "splitTunnel"
```

## Update Checker

`shared/updateChecker.js` checks GitHub Releases API:

- Requires `management` permission in manifests
- Skips store installs (`installType === "normal"`)
- Compares semantic versions
- 30-minute cache TTL (key: `STORAGE_KEYS.UPDATE_CHECK_CACHE`)
- MainPage shows update banner with download link

Firefox also has native auto-update via `update_url` in manifest → `updates.json` in repo.
