# Deep CLI — TODO (Alpha 0.2.x)

Трекер задач между **pre-alpha complete** и **alpha complete**.  
Связанные ADR: [../adr/README.md](../adr/README.md) · план версий: [../docs/VERSION-PLAN.md](../docs/VERSION-PLAN.md)

| ID | Задача | Статус | Вес |
|----|--------|--------|-----|
| [001](./001-alpha-coverage-gate.md) | Покрытие ≥30%, gate в CI | ✅ done | P0 |
| [002](./002-alpha-compact-prune-memory.md) | compaction / pruner / memory.json | ✅ done | P0 |
| [003](./003-alpha-workspace-jail.md) | FS jail + cordis wire | ✅ done | P0 |
| [004](./004-alpha-ci-docker-smoke.md) | CI smoke guest на ubuntu | ✅ done | P0 |
| [005](./005-alpha-audit-gate.md) | Audit gate alpha (21 check) | ✅ done | P1 |
| [006](./006-alpha-readiness-score.md) | `doctor --readiness` для alpha | ✅ done | P2 |
| [007](./007-alpha-network-allowlist.md) | Guest egress env policy | ✅ done | P2 |
| [008](./008-alpha-multistack.md) | `--name` stacks + status | ✅ done | P2 |
| [009](./009-alpha-e2e-signoff.md) | E2E smoke + chat sign-off | 🔄 in progress | P0 |

**Легенда:** ✅ done · 🔄 in progress · ⏳ pending · ❌ blocked

## Критерий alpha complete

1. Все P0 — ✅  
2. `npm run test:coverage` ≥30%  
3. `npm run audit:alpha` — без FAIL  
4. CI: ubuntu job `smoke-guest` green  
5. `npm run smoke:e2e` на живом стеке + ручной DSH chat (см. [009](./009-alpha-e2e-signoff.md))

## Команды

```bash
npm test
npm run test:coverage      # min 30%
npm run smoke:guest        # локально, нужен Docker
npm run smoke:e2e          # живой стек (deep start)
npm run audit:alpha
node bin/deep.js doctor --readiness --stage=alpha
```
