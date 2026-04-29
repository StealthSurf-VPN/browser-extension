---
name: release-extension
description: Use when releasing a new StealthSurf extension version to GitHub. Runs the full pipeline (format, lint, build, pack) and prepares a paste-ready `gh release create` command with auto-generated notes from git log. User-only — invoke explicitly via /release-extension.
disable-model-invocation: true
---

# Release Extension

End-to-end GitHub release prep. Stops short of the actual `gh release create` and `git push` — those are the user's call after reviewing artifacts.

## Prerequisites

- Working tree clean
- Currently on `main`
- Version already bumped via `/bump-extension-version` (or matches across all 5 files)
- `key.pem` present in repo root

## Workflow

### 1. Pre-flight

```bash
git status --porcelain               # must be empty
git rev-parse --abbrev-ref HEAD      # must equal "main"
git fetch --tags                     # ensure latest tags
```

Halt on any failure.

### 2. Version sync check

```bash
grep -h '"version"' package.json manifest/manifest.*.json
```

All four lines must match. If not, abort and recommend `/bump-extension-version`.

Capture the version into `<VERSION>`.

### 3. Quality gates

```bash
npm run format
npm run lint:firefox    # auto-rebuilds AMO Firefox dist + runs web-ext lint
```

If `lint:firefox` exits non-zero, halt.

### 4. Build + package

```bash
npm run release:github
```

Internally: `rm -rf release && build:all:github && pack:all`. Verify these four artifacts exist after the run:

- `release/stealthsurf-chrome-v<VERSION>.zip`
- `release/stealthsurf-chrome-v<VERSION>.crx`
- `release/stealthsurf-firefox-v<VERSION>.zip`
- `release/stealthsurf-firefox-v<VERSION>.xpi`

If any is missing, halt with the failed step.

### 5. Generate release notes

```bash
PREV=$(git tag --sort=-v:refname | head -1)
git log "${PREV}..HEAD" --oneline --no-merges
```

Group by conventional commit prefix:

- `feat:` → **✨ New features**
- `fix:` → **🐛 Bug fixes**
- `refactor:` → **♻️ Refactoring**
- `chore:`, `docs:`, others → **🔧 Other changes**

Use Russian ONLY if the user explicitly asks. Default to English headings, mirror the original commit subjects.

### 6. Output handoff

Print a paste-ready block to the user:

```bash
gh release create v<VERSION> \
  release/stealthsurf-chrome-v<VERSION>.zip \
  release/stealthsurf-chrome-v<VERSION>.crx \
  release/stealthsurf-firefox-v<VERSION>.zip \
  release/stealthsurf-firefox-v<VERSION>.xpi \
  --title "v<VERSION>" \
  --notes "$(cat <<'EOF'
<GENERATED_NOTES>
EOF
)"
```

Plus the post-release reminder for the user:

```bash
# After gh release create succeeds:
git add updates.json package.json manifest/
git commit -m "chore: bump version to <VERSION>"
git push origin main
git push origin v<VERSION>   # if tag was created locally
```

### 7. Stop

Do NOT run `gh release create`, `git tag`, `git commit`, `git push`, or any irreversible / shared-state operation. The user reviews the artifacts and runs the commands.

## Constraints

- This skill targets the **GitHub** release path only. AMO and Chrome Web Store store-listing flows are separate (would use `release:store` + manual portal upload — out of scope).
- If `key.pem` is missing, abort. `pack.mjs` would generate a new one, which **changes the Chrome extension ID** and breaks every existing user. Never let that happen automatically.
- Don't auto-push or auto-tag. Even with user "yes" on chat, write the commands for them to run.

## What this skill does NOT do

- Bump the version (delegate to `/bump-extension-version`).
- Submit to Firefox AMO or Chrome Web Store.
- Run E2E tests (none configured).
- Touch `release/` from previous runs — `release:github` already does `rm -rf release` first.
