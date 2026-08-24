# 009 — E2E stack smoke + chat sign-off

**Status:** ✅ done  
**Priority:** P0

## Goal

Автоматический smoke живого стека + проверка chat path (llama OpenAI API, тот же backend что DSH).

## Checklist

- [x] `scripts/smoke-e2e.mjs` + `npm run smoke:e2e`
- [x] jail / memory / compaction / llama+DSH HTTP / guest bash+net env — PASS
- [x] llama `/v1/chat/completions` → `e2e-ok` (sign-off alpha)
- [ ] Optional: browser DSH UI click-through (manual)
- [ ] Optional: CI job with long-lived stack

## Verify

```bash
deep start --cpu
npm run smoke:e2e
deep stop
```
