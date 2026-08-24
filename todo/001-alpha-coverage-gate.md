# 001 — Coverage gate ≥30%

**Status:** ✅ done  
**Priority:** P0  
**ADR:** —

## Goal

Поднять порог `scripts/coverage-gate.mjs` до **30%** line coverage по `src/` и держать его в CI.

## Checklist

- [x] Default `DEEP_COVERAGE_MIN=30` в coverage-gate
- [x] Тесты `test/jail.test.js`, `test/materialize.test.js`
- [x] CI step «alpha 30%»
- [x] Фактический % ~65% (CHANGELOG)

## Verify

```bash
npm run test:coverage
```

Expected: `src/ coverage: ≥30%` + exit 0.
