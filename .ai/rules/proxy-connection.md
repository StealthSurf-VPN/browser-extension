# Proxy Connection Flow

## Connect

```text
1. User selects a config from MainPage's inline list and taps the power toggle
2. useProxyConnection.connect(config) called:
   a. Check if proxy subconfig exists (config.hasProxy)
   b. If not — create via appropriate API:
      - config: POST /configs/{id}/subconfig { protocol: selectedProtocol }
      - paid_option: POST /paid-options/{oid}/configs/{cid}/subconfig { protocol: selectedProtocol }
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
            → defaults to SOCKS5 and optionally uses HTTP according to proxy_protocol
            → returns SOCKS5 credentials inline; handles HTTP auth via onAuthRequired
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
            + remove the onAuthRequired authentication listener
5. chrome.storage.local state cleared
6. Badge cleared
7. Popup resets proxyAtom
```

## Location Change

```text
1. User clicks "Изменить локацию" for the displayed config
2. LocationPicker expands inline on MainPage and measures location pings
3. User selects new location
4. If currently connected to this config → disconnect first
5. Call changeLocation API (preserving current protocol)
6. Existing proxy subconfig is invalidated
7. If previously connected → auto-connect with new credentials (creates new subconfig)
8. Reload resources and collapse LocationPicker after success
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

- Chrome proxy subconfigs use HTTP; the PAC script emits the `PROXY` directive and `onAuthRequired` supplies credentials.
- Firefox defaults to SOCKS5 and optionally uses HTTP according to the `proxy_protocol` preference.
- Proxy subconfig creation must pass the selected protocol instead of an unconditional `{ protocol: "http" }`.
- Firefox `proxy.onRequest` returns SOCKS5 credentials inline with `type: "socks"` and `proxyDNS: true`; Firefox HTTP authentication uses `onAuthRequired`.
- The selected protocol is persisted in `proxy_state` for restart recovery.

## Error Handling

- errorCode 7: subconfig already exists → fetch existing one
- errorCode 9: no free servers on location
- Invalid credentials: host/port validated, user/pass type-checked
- Network errors: show snackbar, don't crash
- Service worker restart: auto-restore from storage
- Toggle reconnect failure: snackbar notification
