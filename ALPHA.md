# Deep CLI — Alpha 0.2.0

**Стадия:** alpha in progress · readiness `doctor --readiness --stage=alpha`

```powershell
node bin/deep.js doctor --readiness --stage=alpha
node bin/deep.js stacks
```

## Что вошло в alpha

| Область | Статус |
|---------|--------|
| Workspace FS jail | wired в cordis |
| memory.json + compaction/pruner | OK |
| Coverage ≥30% | ~69% src |
| Guest smoke CI | `smoke:guest` |
| Audit gate alpha | `npm run audit:alpha` |
| Multi-stack | `deep stacks`, `--name`, GPU lock |
| Guest net env | `DEEP_NET_MODE` / `DEEP_NET_ALLOWLIST` |

Трекер: [todo/README.md](./todo/README.md) · ADR: [adr/README.md](./adr/README.md)

## Быстрый цикл (sign-off)

```powershell
deep stop
deep bootstrap
deep start --cpu
npm run smoke:e2e
# открой DSH URL из status — короткий чат
deep stop
```

## Критерий alpha complete

1. Все P0 в todo — ✅  
2. Coverage / audit / CI smoke — ✅  
3. `npm run smoke:e2e` на живом стеке — PASS  
4. Ручной чат в DSH с jail (один turn) — sign-off  

## До beta

- Hard egress proxy (сейчас только env policy)
- Compact/prune enforcement audit #22
- Coverage ≥50%, TTY polish
