# Deep CLI — Alpha 0.2.0

**Стадия: complete** · `doctor --readiness --stage=alpha` → 100/100  
**Tag:** `v0.2.0-alpha` · revision `2026.08.24-alpha`

```powershell
node bin/deep.js doctor --readiness --stage=alpha
npm run smoke:e2e
```

## Что вошло

| Область | Статус |
|---------|--------|
| Workspace FS jail | ✅ |
| memory.json + compaction/pruner | ✅ |
| Coverage ≥30% (~69% src) | ✅ |
| Guest smoke CI | ✅ |
| Audit gate alpha | ✅ |
| Multi-stack + GPU lock | ✅ |
| Guest net env policy | ✅ |
| E2E smoke (HTTP + llama chat + guest) | ✅ |

Трекер: [todo/README.md](./todo/README.md) · ADR: [adr/README.md](./adr/README.md) · Beta: [todo/README-beta.md](./todo/README-beta.md)

## Sign-off (2026-08-24)

- `npm run audit:alpha` — OK (0 FAIL)
- `npm run smoke:guest` — PASS
- `npm run smoke:e2e` — PASS (`e2e-ok` chat via llama OpenAI API used by DSH)
- Stack GREEN: engine / guest / llama / DSH

## До beta (`0.3` / `0.4`)

См. [todo/README-beta.md](./todo/README-beta.md): hard egress proxy, audit #22, coverage ≥50%, CDN artifacts.
