# 0005 — Workspace jail for FS tools

**Status:** Accepted  
**Date:** 2026-08-24

## Context

DSH fs tools (Read/Write/Edit/Glob) по умолчанию видят широкий sandbox. Агент может галлюцинировать пути `/workspace/...` или `/tmp/...`.

## Decision

Plugin **`workspace-jail-fs`**:

- `GIM_WORKSPACE` / `HOST_SHARE` = absolute host workspace
- `rewriteWorkspacePath()` maps `/workspace/*`, `/tmp/*`, `/home/*` → under workspace
- Wired via `cordis.gim.patch.yml` → `fs-sandbox.backend`

Core logic in `src/workspace-jail.js`; copied to `jail-core.mjs` at materialize.

## Consequences

- Agent file I/O bounded to stack workspace
- Paths outside jail rejected by sandbox resolve
- Verified: `test/jail.test.js`, `npm run test:security`
