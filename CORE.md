# Deep CLI — 0.5 (core freeze)

**Стадия:** `0.5.0` — последние изменения ядра перед 1.0  
**License:** [CC BY-NC-SA 4.0](./LICENSE)

```powershell
node bin/deep.js doctor --readiness --stage=0.5
npm run test:coverage
```

## Field sign-off (this host)

| OS | Результат | Дата |
|----|-----------|------|
| Windows + Docker + NVIDIA | ✅ Engine/Guest/Llama/DSH GREEN | 2026-08-24 |

## Gate

| Критерий | Статус |
|----------|--------|
| RC 100% | ✅ |
| Coverage ≥75% | ✅ (target) |
| Windows field GREEN | ✅ |
| CDN Release upload | ⏳ `gh auth login` |

See [RC.md](./RC.md) · [BETA.md](./BETA.md)
