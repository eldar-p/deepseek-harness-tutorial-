# 0005 — Workspace jail for FS tools

**Status:** Accepted  
**Date:** 2026-08-24

## Context

DSH fs tools (Read/Write/Edit/Glob) по умолчанию видят широкий sandbox. Агент может галлюцинировать пути `/workspace/...` или `/tmp/...`.

## Decision

Plugin **`workspace-jail-fs`**:

- `DEEP_WORKSPACE` / `HOST_SHARE` = absolute host workspace
- `rewriteWorkspacePath()` maps `/workspace/*`, `/tmp/*`, `/home/*` → under workspace
- Wired via `cordis.deep.patch.yml` → `fs-sandbox.backend`

Core logic in `src/workspace-jail.js`; copied to `jail-core.mjs` at materialize.

Legacy **`path-fix-fs`** (VM `/mnt/hostshare`) — только tutorial track.

## Consequences

- Alpha security: agent file I/O bounded to stack workspace
- Paths outside jail still rejected by sandbox resolve
- E2E verification tracked in todo/003
