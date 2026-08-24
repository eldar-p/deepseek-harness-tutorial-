# 004 — CI Docker smoke

**Status:** ✅ done  
**Priority:** P0  
**ADR:** [002-guest-container-over-virtualbox](../adr/002-guest-container-over-virtualbox.md)

## Goal

GitHub Actions на **ubuntu-latest** с Docker: build `deep-guest:prealpha` + mount smoke без GGUF.

## Checklist

- [x] `scripts/smoke-guest.mjs`
- [x] CI job `smoke-guest` (ubuntu + docker)
- [x] Local PASS verified

## Verify

```bash
npm run smoke:guest
# CI: workflow CI → smoke-guest
```

Expected: `[smoke] PASS`
