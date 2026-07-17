Read and follow this checklist for changes to authentication, background message handling, proxy authentication, `src/api/api.instance.js`, or any `src/api/routes/*.js`. Verify every documented security invariant remains intact and report deviations. The invariants are defined in `AGENTS.md`, `.ai/rules/extension-architecture.md`, and the code itself.

## Scope

For every review:

1. Read `AGENTS.md` (security constraints)
2. Read `.ai/rules/extension-architecture.md`
3. Read all files in scope (see "Targets" below)

## Task Context

- For a standalone review task, use this checklist as a read-only review. Do not modify code. Do not run builds.
- For an implementation or change/build task, implement the requested changes, then apply this checklist after the implementation. The standalone review restrictions do not apply. Run the build and verification commands required by `.ai/rules/build-workflow.md`.

## Targets

Required reads:

- `src/background/messageHandler.js`
- `src/background/authManager.js`
- `src/background/proxyChrome.js`
- `src/background/proxyFirefox.js`

Conditional reads (if recently modified — use `git diff` knowledge or Grep):

- `src/api/api.instance.js` (token handling)
- `src/api/routes/*.js` (anything that takes credentials/tokens)
- `src/shared/pkce.js` (challenge/verifier generation)
- `src/callback/callback.js` (Firefox OAuth callback)

## Invariants to Verify

For each, locate the code, confirm intact, or flag deviation.

### I-1. Sender identity validation

`messageHandler.js` MUST guard the entry of `handleMessage` with:

```js
if (sender.id !== chrome.runtime.id) {
  sendResponse({ error: "Unauthorized" });
  return;
}
```

Severity if missing: **HIGH** — any web page on a granted-permission origin could send messages.

### I-2. Firefox callback URL validation

`AUTH_FIREFOX_CODE` handler MUST verify:

```js
sender.url.startsWith(chrome.runtime.getURL("callback.html"))
```

Severity if missing: **HIGH** — arbitrary content scripts could submit auth codes.

### I-3. Auth code length cap

Both `AUTH_FIREFOX_CODE` handler and `startChromeOAuth.updateListener` MUST cap auth code at 2048 chars and require `typeof === "string"`.

Severity if missing: **MEDIUM** — DoS via huge payload, also defense-in-depth.

### I-4. Credential type validation

`PROXY_CONNECT` handler MUST validate:

- `msg.credentials?.host && msg.credentials?.port` — present
- `msg.credentials.user`, `msg.credentials.pass` — strings if present (allowing null)

Severity if missing: **MEDIUM** — malformed credentials could crash or pass garbage to proxy APIs.

### I-5. Token format validation

`AUTH_SET_TOKENS` handler MUST require `msg.accessToken?.token && msg.refreshToken?.token`.

Severity if missing: **MEDIUM**.

### I-6. OAuth concurrency lock

`authManager.startOAuthFlow` MUST gate with `authInProgress` boolean and use `try/finally` to release the lock. Lock must be released even on rejection.

Severity if missing: **MEDIUM** — concurrent OAuth flows can interleave PKCE state.

### I-7. PKCE state cleanup

`completeFirefoxOAuth` MUST remove `OAUTH_CODE_VERIFIER` and `OAUTH_REDIRECT_URI` from storage in `finally`. Stale verifier on disk = replay window.

Severity if missing: **MEDIUM**.

### I-8. Auth retry cap (both proxy files)

`authHandler` in `proxyChrome.js` and `proxyFirefox.js` MUST:

- Increment a per-`requestId` counter
- Return `{ cancel: true }` when count >= 2
- Cap `authRetries.size` at 1000 with `clear()` overflow

Severity if missing: **HIGH** — infinite auth retry loop on bad credentials = browser hang / lockout. Also unbounded Map = memory leak.

### I-9. Per-kind sanitization (PAC injection surface)

`proxyChrome.js` MUST sanitize before injection into PAC string:

- `sanitizeDomain` — `[a-z0-9.*_-]` whitelist + structural regex; rejects empty
- `sanitizeIpv4` — strict octet regex
- `sanitizePrefix(n, max)` — `Number.isInteger(i) && 0 <= i <= max`
- `sanitizeHost` — `[a-z0-9.\-]` whitelist for proxy hostname
- `sanitizePort` — integer 1..65535

IPv6 entries MUST be emitted as integer arrays (`parseIPv6` returns bytes, then `[${bytes.join(",")}]`), not as raw strings inside PAC literals.

Severity if any sanitizer weakens: **HIGH** — PAC script runs in privileged proxy context; injection = arbitrary JS in proxy decisions.

### I-10. Token clearing on permanent auth failure

`refreshAccessToken` MUST call `clearTokens()` when:

- Refresh token expired (`refreshToken.expires_at < getCurrentTimestamp()`)
- Backend returns 4xx (except 429)

Severity if missing: **MEDIUM** — stale invalid tokens remain, popup loops on failed refresh.

### I-11. Refresh deduplication

`refreshAccessToken` MUST use the singleton `refreshPromise` pattern so concurrent callers share one network request.

Severity if missing: **LOW** (correctness, not security) — multiple parallel refreshes can race and overwrite tokens.

### I-12. Chrome OAuth tab timeout

`startChromeOAuth` MUST have a 5-minute timeout that calls `cleanup()` and rejects if no redirect arrives.

Severity if missing: **LOW** — stale listeners leak across SW lifetime; `authInProgress` could stay locked.

### I-13. Tab close detection

`startChromeOAuth` MUST register `chrome.tabs.onRemoved` listener that rejects on user-closed tab and removes listeners.

Severity if missing: **LOW** — same leak as I-12.

### I-14. Backend URL normalization

`authManager.js` MUST normalize `__BACKEND_URL__.replace(/\/+$/, "") + "/"` before constructing token endpoint URLs to prevent double-slash and request smuggling-adjacent quirks.

Severity if missing: **LOW**.

### I-15. PROXY_STATE never logs credentials

Grep for `console.log`, `console.warn`, `console.info` in `proxyChrome.js`, `proxyFirefox.js`, `authManager.js`. Flag any log that includes `credentials`, `pass`, `user`, `token`, `proxyResult`, or full `proxyConfig`. Existing `console.error("Token refresh failed:", err)` and `console.error('Handler error [${type}]:', err)` are OK if the error string itself doesn't carry credentials.

Severity: **HIGH** if a credential-leaking log is found.

## Output Format

```
## Extension Security Review

### Summary
- Invariants checked: 15
- HIGH deviations: [N]
- MEDIUM deviations: [N]
- LOW deviations: [N]

### Deviations

1. **[I-X] [invariant name]** — [HIGH|MEDIUM|LOW]
   - File: `path/to/file.js:LINE`
   - Expected: [the invariant in one sentence]
   - Actual: [what the code does instead]
   - Fix sketch: [one line, no code]

2. ...

### Verified
- I-1 sender.id check: ✓ `messageHandler.js:127`
- I-2 callback URL: ✓ `messageHandler.js:108`
- ...
```

Order deviations: HIGH first, then MEDIUM, then LOW. If a standalone review finds zero deviations, return only the "Verified" section.
