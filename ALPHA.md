# GIM CLI — Alpha 0.2.0

**Стадия: complete** · `doctor --readiness --stage=alpha` → 100/100  
**Tag:** `v0.2.0-alpha` · revision `2026.08.24-alpha`

```powershell
node bin/gim.js doctor --readiness --stage=alpha
npm run smoke:e2e
npm run test:security
```

## Что вошло

| Область | Статус |
|---------|--------|
| Workspace FS jail | ✅ |
| memory.json + compaction/pruner | ✅ |
| Coverage ≥30% (~69% src) | ✅ |
| Guest smoke CI | ✅ |
| Audit gate alpha + security 32 | ✅ |
| Multi-stack + GPU lock | ✅ |
| Guest net env policy | ✅ |
| E2E smoke (HTTP + llama chat + guest) | ✅ |
| Colibri Docker default (Win/Linux) | ✅ |
| Native GIM UI | ✅ |
| Security eval P6 | ✅ |

ADR: [adr/README.md](./adr/README.md) · OS: [docs/OS-COMPAT.md](./docs/OS-COMPAT.md)

## Sign-off (2026-08-24)

- `npm run audit:alpha` — OK (0 FAIL)
- `npm run audit:security` — OK
- `npm run smoke:guest` — PASS
- `npm run smoke:e2e` — PASS
- Stack GREEN: engine / guest / llama / UI

## Дальше

См. [docs/SPEED.md](./docs/SPEED.md) · [docs/SECURITY-EVAL.md](./docs/SECURITY-EVAL.md) · [CHANGELOG.md](./CHANGELOG.md)
