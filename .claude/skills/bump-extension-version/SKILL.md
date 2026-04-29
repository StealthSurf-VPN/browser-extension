---
name: bump-extension-version
description: Use when bumping the StealthSurf extension version. Synchronizes the version field across package.json, all three browser manifests, and the Firefox auto-update manifest. User-only — invoke explicitly via /bump-extension-version.
disable-model-invocation: true
---

# Bump Extension Version

Atomic version bump across all version-tracking files in the StealthSurf extension. Forgetting one file silently breaks: AMO/CWS reject mismatched manifests, and Firefox GitHub installs stop auto-updating.

## Files Updated

| File | Field | Notes |
|------|-------|-------|
| `package.json` | top-level `"version"` | Source of truth — `pack.mjs` reads from here |
| `manifest/manifest.chrome.json` | top-level `"version"` | Chrome MV3 |
| `manifest/manifest.firefox.json` | top-level `"version"` | Firefox AMO |
| `manifest/manifest.firefox.github.json` | top-level `"version"` | Firefox GitHub variant |
| `updates.json` | append entry to `addons["extension@stealthsurf.app"].updates[]` | Firefox auto-update only |

## Workflow

1. **Read current version** from `package.json` (line 3 area, key `"version"`).
2. **Verify in-sync** — all 4 files (package.json + 3 manifests) must currently have the same version. If they drift, halt and report which file disagrees before bumping.
3. **Ask user**: `patch` / `minor` / `major`, or accept an explicit version. Default to `patch`.
4. **Compute next** semver. Example: `1.0.12` + patch → `1.0.13`.
5. **Edit version field** in all four version files (single line change each).
6. **Append entry** to `updates.json` `addons["extension@stealthsurf.app"].updates[]` array (after the existing entries):
   ```json
   {
     "version": "<NEW>",
     "update_link": "https://github.com/stealthsurf-vpn/browser-extension/releases/download/v<NEW>/stealthsurf-firefox-v<NEW>.xpi"
   }
   ```
   The URL pattern is fixed — Firefox auto-update reads it literally; the `.xpi` artifact must exist at that exact path after release.
7. **Run** `npm run format` (Biome rewrites JSON with tabs).
8. **Show diff** of all 5 modified files together. Wait for user approval.
9. **Stop.** Do NOT git add, commit, push, or tag.

## Constraints

- Never bump backwards (NEW must be strictly greater than CURRENT in semver order).
- If `updates.json` already has an entry for the target version, do NOT duplicate — flag as already bumped and stop.
- Do not touch `release/`, `dist/`, `key.pem`, or any source code.
- Do not invent additional version fields — only the five locations above.

## What this skill does NOT do

- Build, package, lint, test, commit, tag, push, or open PRs.
- Update `CHANGELOG.md` (project doesn't maintain one).
- Submit to Firefox AMO or Chrome Web Store.
- Tag a release. The `git tag v<NEW>` + `gh release create` belong in `/release-extension`.

## Verification

After all edits, run:

```bash
grep -h '"version"' package.json manifest/manifest.*.json
```

All four lines must show the new version. Then:

```bash
jq '.addons."extension@stealthsurf.app".updates[-1].version' updates.json
```

Must print the new version (last entry).
