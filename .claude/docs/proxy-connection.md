# Proxy Connection Flow

## Connect

```text
1. User clicks "Подключить" on a config card (ConfigSelectPage)
   or taps the power toggle (MainPage)
2. useProxyConnection.connect(config) called:
   a. Check if proxy subconfig exists (config.hasProxy)
   b. If not — create via appropriate API:
      - config: POST /configs/{id}/subconfig { protocol: "http" }
      - paid_option: POST /paid-options/{oid}/configs/{cid}/subconfig { protocol: "http" }
      - cloud: already has proxy with connection_url
   c. Parse connection_url → { host, port, user, pass }
   d. Validate credentials: host and port required, user/pass must be strings
   e. Send PROXY_CONNECT to background with credentials + protocol + configMeta
3. Background (proxyManager.connect):
   Chrome: builds PAC script with split tunnel rules
           → uses PROXY directive
           → chrome.proxy.settings.set()
           + registers onAuthRequired listener (retry limit: 2 per requestId)
   Firefox: registers proxy.onRequest listener
            → uses http
4. Background persists state (including protocol) to chrome.storage.local
5. Badge set to country code of exit IP (via popup UPDATE_BADGE message)
6. Popup updates proxyAtom state
```

## Disconnect

```text
1. User clicks "Отключить" or taps power toggle while connected
2. useProxyConnection.disconnect() called
3. Send PROXY_DISCONNECT to background
4. Background:
   Chrome: chrome.proxy.settings.clear() + remove onAuthRequired
   Firefox: browser.proxy.onRequest.removeListener()
5. chrome.storage.local state cleared
6. Badge cleared
7. Popup resets proxyAtom
```

## Location Change

```text
1. User clicks location button on a config
2. LocationSelectPage opens with ping measurement
3. User selects new location
4. If currently connected to this config → disconnect first
5. Call changeLocation API (preserving current protocol)
6. Existing proxy subconfig is invalidated
7. Auto-connect with new credentials (creates new subconfig)
8. Return to MainPage
```

## Restore on Popup Open

Every time the popup opens, it queries background:

```javascript
const status = await chrome.runtime.sendMessage({ type: MSG.PROXY_STATUS })
// Returns: { connected, configMeta }
```

## Service Worker Restart

When Chrome kills and restarts the service worker:

```javascript
// initProxyManager() in background/index.js
// Reads proxyState from chrome.storage.local (includes protocol field)
// If was connected → re-registers onAuthRequired listener
// Proxy settings persist across restarts (chrome.proxy.settings is declarative)
```

## Split Tunneling Integration

When split tunnel settings change:

1. SettingsPage/SplitTunnelPage saves to `chrome.storage.local`
2. Sends `MSG.UPDATE_PROXY_SETTINGS` to background
3. Background reads split tunnel config from storage
4. Chrome: rebuilds PAC script with new domain rules → re-applies
5. Firefox: updates module-level variables used by onRequest listener

## Connection URL Format

```text
protocol://username:password@hostname:port
```

Parsed by `shared/parseConnectionUrl.js`:

```javascript
parseConnectionUrl("http://user:pass@1.2.3.4:1080")
// → { host: "1.2.3.4", port: "1080", user: "user", pass: "pass" }
```

## Protocol Support

HTTP proxy protocol is used:

- Chrome: PAC script uses `PROXY` directive
- Firefox: proxy.onRequest returns `type: "http"`
- Protocol persisted in `proxy_state` for service worker restart

## Error Handling

- errorCode 7: subconfig already exists → fetch existing one
- errorCode 9: no free servers on location
- Invalid credentials: host/port validated, user/pass type-checked
- Network errors: show snackbar, don't crash
- Service worker restart: auto-restore from storage
- Toggle reconnect failure: snackbar notification
