# 009 — E2E stack smoke + chat sign-off

**Status:** 🔄 in progress  
**Priority:** P0

## Goal

Автоматический smoke живого стека + ручной короткий чат в DSH.

## Checklist

- [x] `scripts/smoke-e2e.mjs` + `npm run smoke:e2e`
- [x] jail / memory / compaction / llama+DSH HTTP / guest bash+net env — PASS
- [ ] Ручной чат в DSH (один turn) — sign-off пользователя
- [ ] Опционально: CI job после `smoke-guest` (если runner держит долгоживущий стек)

## Verify

```bash
deep start --cpu
npm run smoke:e2e
# открой DSH URL → короткий вопрос
deep stop
```
