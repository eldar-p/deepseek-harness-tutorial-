# 003 — Workspace FS jail

**Status:** ✅ done  
**Priority:** P0  
**ADR:** [005-workspace-jail-for-fs-tools](../adr/005-workspace-jail-for-fs-tools.md)

## Goal

Read/Write/Edit/Glob только внутри workspace; пути `/workspace/...` из guest мапятся на host.

## Checklist

- [x] `src/workspace-jail.js` — `rewriteWorkspacePath`
- [x] `dsh-plugins/workspace-jail-fs` + sync `jail-core.mjs` при materialize
- [x] `cordis.deep.patch.yml` → `fs-sandbox.backend: workspace-jail-fs`
- [x] Unit tests `test/jail.test.js`
- [x] E2E manual: mount smoke + cordis wire (full agent E2E — todo)

## Verify

```bash
npm test -- test/jail.test.js
deep bootstrap && grep workspace-jail-fs ~/.deep/dsh-home/profiles/web/cordis.patch.yml
```
