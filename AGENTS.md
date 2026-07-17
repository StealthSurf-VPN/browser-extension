# AGENTS.md

Guide for coding agents working with the StealthSurf Browser Extension.

## Communication

- Always reply to the user in Russian.
- Write code comments and JSDoc in English.
- Keep user-visible UI strings in Russian.

## Project Overview

StealthSurf Browser Extension is a cross-browser extension for connecting to StealthSurf VPN proxies. It targets Chrome Manifest V3 and Firefox Manifest V2 and provides configuration selection, one-click connection, location changes, split tunneling, account synchronization, and update checks.

The project uses React 18.3.1, Vite 6.4.1, VK UI 6.7.4, Recoil 0.7.7, Axios, Biome, Sass, and `@vitejs/plugin-react-swc`. Source code is JavaScript and JSX only; TypeScript is not used.

## Commands

```bash
npm install                  # Install dependencies
npm run format               # Format with Biome
npm run lint                 # Lint with Biome
npm run dev:chrome           # Chrome watch build
npm run dev:firefox          # Firefox watch build
npm run build:chrome         # Chrome MV3 build -> dist/chrome/
npm run build:firefox        # Firefox MV2 AMO build -> dist/firefox/
npm run build:firefox:github # Firefox MV2 GitHub build with update_url
npm run build:all            # Chrome + Firefox AMO builds
npm run build:all:github     # Chrome + Firefox GitHub builds
npm run lint:firefox         # Rebuild Firefox AMO and run web-ext lint
npm run pack:zip             # Create Chrome ZIP
npm run pack:crx             # Create Chrome CRX
npm run pack:xpi             # Create Firefox XPI
npm run pack:all             # Create ZIP, CRX, and XPI artifacts
npm run release:store        # Store builds and packages
npm run release:github       # GitHub builds and packages
```

Required build variables are `VITE_BACKEND_URL`, `VITE_CONSOLE_URL`, and `VITE_CDN_DOMAIN`; see `.env.example`.

## Conventions

- Use JavaScript and JSX only; do not add TypeScript.
- Use relative imports because extensions do not support absolute `/src/...` imports.
- Name components in PascalCase, utilities in camelCase, and hooks with a `use` prefix.
- Use tabs for indentation and double quotes.
- Keep the classic JSX runtime and import React where required by the existing code.
- Use Biome through `npm run format` and `npm run lint`.
- Keep changes focused and preserve existing cross-browser behavior.

## Extension Constraints

- Chrome uses Manifest V3 with an ephemeral background service worker and an HTTP PAC proxy. Authenticated SOCKS5 is not supported by Chrome extension APIs.
- Firefox uses Manifest V2 and `browser.proxy.onRequest`; it defaults to SOCKS5 and can optionally use HTTP.
- Persist cross-context and restart-safe state in `chrome.storage.local`. Do not rely on popup memory, service-worker memory, or `localStorage` for persistent state.
- The popup and Chrome service worker are ephemeral and must restore state when opened or restarted.
- Validate `sender.id === chrome.runtime.id` for background messages. Validate the Firefox OAuth callback URL for `AUTH_FIREFOX_CODE`.
- Internal API and console hosts bypass the proxy unless the user explicitly enables proxying all traffic.
- Do not manually edit `.env.production`, `key.pem`, or `package-lock.json`.
- Let npm update `package-lock.json` only when an explicitly requested dependency operation requires it.

## Shared Agent Instructions

`AGENTS.md` is the canonical entrypoint for every coding agent. Detailed shared rules live in `.ai/rules/`. These files are not loaded automatically.

Before changing project code, every agent must read and follow:

- `.ai/rules/code-style.md`
- `.ai/rules/build-workflow.md`

Read and follow every additional rule that matches the task before editing:

- API client or route code: `.ai/rules/api-patterns.md`.
- React components, pages, hooks, popup state, or styles: `.ai/rules/component-patterns.md`.
- Background messaging, storage, manifests, proxy behavior, split tunneling, or browser APIs: `.ai/rules/extension-architecture.md`.
- OAuth, PKCE, tokens, callback pages, or authentication: `.ai/rules/auth-flow.md` and `.ai/rules/security-review.md`.
- Proxy connection or split-tunneling behavior: `.ai/rules/proxy-connection.md`.
- Chrome/Firefox proxy implementations or shared IP/PAC helpers: `.ai/rules/cross-browser-review.md`.
- Security-sensitive background or API changes: `.ai/rules/security-review.md`.
- Every change to message handling, proxy authentication, `src/api/api.instance.js`, or any `src/api/routes/*.js`: `.ai/rules/security-review.md`.
- Extension version changes: `.ai/rules/versioning.md`.
- GitHub release preparation: `.ai/rules/release-extension.md` and `.ai/rules/versioning.md`.

More than one rule can apply to the same task.
