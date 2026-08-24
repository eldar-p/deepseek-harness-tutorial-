# 006 — Alpha readiness score

**Status:** ✅ done  
**Priority:** P2

## Goal

Расширить `doctor --readiness` для этапа alpha.

## Checklist

- [x] `src/readiness.js` — `ALPHA_MILESTONES`
- [x] `deep doctor --readiness --stage=alpha`
- [x] Tests `test/readiness.test.js`

## Verify

```bash
node bin/deep.js doctor --readiness --stage=alpha
```
