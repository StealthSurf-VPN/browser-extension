# Authentication Flow (PKCE)

## Overview

The extension authenticates via the main StealthSurf site using PKCE OAuth with authorization code exchange. The background service worker manages the full flow.

## Flow

```text
1. User opens popup → not authenticated
2. Click "Войти через сайт"
3. Background generates PKCE code_verifier + code_challenge (SHA-256)
4. Extension opens tab:
   __CONSOLE_URL__/auth/connect?client_id=stealthsurf-proxy-extension
     &code_challenge={challenge}&code_challenge_method=S256&redirect_uri={redirectUri}
5. User authenticates on main site
6. Site redirects to redirect_uri?code={authorization_code}
7. Code exchange:
   Chrome: background detects redirect via chrome.tabs.onUpdated,
           calls POST __BACKEND_URL__/auth/connect/token
           with { grant_type: "authorization_code", code, code_verifier, client_id, redirect_uri }
   Firefox: callback.html extracts code from URL params,
            sends AUTH_FIREFOX_CODE to background,
            background exchanges code via same endpoint
8. Backend returns { access_token, refresh_token }
9. Tokens saved to chrome.storage.local
10. Popup detects tokens via chrome.storage.onChanged → authenticated
```

## Redirect URIs

- Chrome: `chrome.identity.getRedirectURL()` → `https://{ext-id}.chromiumapp.org/`
- Firefox: `moz-extension://{runtime.id}/callback`

## Token Storage

Tokens in `chrome.storage.local`:

```javascript
{
  access_token: { token: "eyJ...", expires_at: 1709654400 },
  refresh_token: { token: "abc...", expires_at: 1712246400 }
}
```

## Token Refresh

- Background checks token expiry every 5 minutes via `chrome.alarms`
- Popup's Axios interceptor delegates refresh to background via `MSG.AUTH_REFRESH`
- Background calls `POST __BACKEND_URL__/auth/connect/token` with `{ grant_type: "refresh_token", refresh_token, client_id }`
- Refresh deduplication: `refreshPromise` singleton prevents concurrent refreshes
- On permanent failure (4xx except 429): tokens cleared, re-authentication required
- Popup-side refresh has 10s timeout via `Promise.race`

## Concurrency Protection

- `authInProgress` flag prevents concurrent OAuth flows
- Flag released in `finally` block AFTER `await`ing the result (not on immediate return)
- Chrome OAuth has 5-minute timeout via `setTimeout` (cleanup: listeners + tab)
- Firefox OAuth state (`code_verifier`, `redirect_uri`) cleaned up in `completeFirefoxOAuth` via `try/finally`

## Logout

```javascript
chrome.runtime.sendMessage({ type: MSG.AUTH_CLEAR })
// Background: clears tokens + disconnects proxy + removes connected config
```

## Backend Endpoints

```text
POST __BACKEND_URL__/auth/connect/token
Content-Type: application/json

# Authorization code exchange
Body: {
  "grant_type": "authorization_code",
  "code": "...",
  "code_verifier": "...",
  "client_id": "stealthsurf-proxy-extension",
  "redirect_uri": "..."
}

# Token refresh
Body: {
  "grant_type": "refresh_token",
  "refresh_token": "...",
  "client_id": "stealthsurf-proxy-extension"
}

Response:
{
  "data": {
    "access_token": { "token": "...", "expires_at": ... },
    "refresh_token": { "token": "...", "expires_at": ... }
  }
}
```

## Main Site Requirements

Route `/auth/connect`:

- Shows login/confirmation UI
- Receives `client_id`, `code_challenge`, `code_challenge_method`, `redirect_uri` from URL params
- After authentication, redirects to `redirect_uri?code={authorization_code}`
