# API Patterns

## API Instance

`NETWORK` in `src/api/api.instance.js` — adapted Axios instance for browser extensions.

Key differences from main site:

- Tokens stored in `chrome.storage.local` (async), not `localStorage`
- Token refresh delegated to background via `MSG.AUTH_REFRESH`
- No `window.dispatchEvent` — not available in service workers
- Backend URL injected via Vite `define: { __BACKEND_URL__ }` instead of `import.meta.env`

## Route Files

Trimmed copies from the main site (`shanghai/src/api/routes/`). Only functions needed for the extension are kept.

```javascript
// src/api/routes/route.configs.js
export const getConfigs = () => NETWORK.get("configs")
export const getSubconfig = (id) => NETWORK.get(`configs/${id}/subconfig`)
export const createSubconfig = (id, data) => NETWORK.post(`configs/${id}/subconfig`, data)
export const changeLocation = (id, body) => NETWORK.patch(`configs/${id}/settings`, body)
```

## Response Structure

Same as main site:

```javascript
// Success
{ status: true, statusCode: 200, data: { ... } }

// Error
{ status: false, errorCode: 1, message: "ERROR_CODE" }
```

## Error Handling

Always check `res.data.status`:

```javascript
const res = await createSubconfig(configId, { protocol: "http" })

if (res.data.status) {
  // Success — use res.data.data
} else if (res.data.errorCode === 7) {
  // Subconfig already exists — fetch it instead
}
```

## Proxy Subconfig Creation

Three sources, three different API calls:

```javascript
// Regular config
createSubconfig(configId, { protocol: "http" })

// Paid option config
createPaidOptionConfigSubconfig(optionId, configId, { protocol: "http" })

// Cloud server proxy
createCloudServerProxy(serverId, { protocol: "http" })
```

All return `connection_url` in format: `protocol://user:pass@host:port`

Protocol is determined by the config (HTTP).

## Location Change

Only for regular configs and paid option configs (cloud servers have fixed location):

```javascript
// Regular config
changeLocation(configId, { location_id: "18", protocol: "vless" })

// Paid option config
updatePaidOptionConfigSettings(optionId, configId, { location_id: "18", protocol: "vless" })
```

After location change, the existing proxy subconfig is invalidated — create a new one.
