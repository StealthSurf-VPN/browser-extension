# Release Extension

End-to-end GitHub release prep. Stops short of the actual `gh release create` and `git push` — those are the user's call after reviewing artifacts.

## Prerequisites

- The version bump from `.ai/rules/versioning.md` has been approved by the user and committed before this workflow starts
- Working tree clean
- Currently on `main`
- Versions match across all five locations: `package.json`, the three manifests, and the last `updates.json` entry
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
VERSION=$(jq -r '.version' package.json)
grep -h '"version"' package.json manifest/manifest.*.json
jq -r '.addons."extension@stealthsurf.app".updates[-1].version' updates.json
```

All four `version` lines and the last `updates.json` version must match `$VERSION`. If any value differs, abort and recommend `.ai/rules/versioning.md`. Do not modify or recommit version files during the release workflow. Use `$VERSION` as `<VERSION>` in the remaining steps.

### 3. Quality gates

```bash
npm run format
git status --porcelain --untracked-files=no
```

If the post-format status prints any tracked changes, stop before lint, build, or package. Show the changes to the user for review and commit, then require the release workflow to restart from a clean working tree. Do not stage or commit the formatting changes automatically.

Only when the post-format status is empty, continue:

```bash
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

Print one paste-ready block to the user in this order. Do not execute any command in the block:

```bash
git push origin main
git tag v<VERSION>
git push origin v<VERSION>
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

### 7. Stop

Do NOT run `git add`, `git commit`, `git push`, `git tag`, `gh release create`, or any publish or irreversible shared-state operation. The user reviews the artifacts and runs the printed commands in order.

## Constraints

- This workflow targets the **GitHub** release path only. AMO and Chrome Web Store store-listing flows are separate (would use `release:store` + manual portal upload — out of scope).
- If `key.pem` is missing, abort. `pack.mjs` would generate a new one, which **changes the Chrome extension ID** and breaks every existing user. Never let that happen automatically.
- Do not automatically commit, push, tag, or publish. Even with user approval in chat, only print the commands for them to run.

## What this workflow does NOT do

- Bump the version (follow `.ai/rules/versioning.md`).
- Submit to Firefox AMO or Chrome Web Store.
- Run E2E tests (none configured).
- Touch `release/` from previous runs — `release:github` already does `rm -rf release` first.
