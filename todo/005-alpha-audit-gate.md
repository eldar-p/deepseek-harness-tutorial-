# 005 — Audit gate alpha

**Status:** ✅ done  
**Priority:** P1  
**ADR:** [003-manifest-pin-and-sha256](../adr/003-manifest-pin-and-sha256.md)

## Goal

`npm run audit:alpha` — 21 проверка без FAIL (см. `scripts/audit-run.mjs` GATE_CHECKS.alpha).

## Checklist

- [x] Прогнать `node scripts/audit-run.mjs --gate=alpha` — OK (1 WARN TTY)
- [x] `npm run audit:alpha` в package.json
- [ ] CI step audit alpha (optional nightly)

## Verify

```bash
npm run audit:alpha
```

Expected: `Gate alpha: OK`
