# GIM CLI — 2.0.0 release candidate

**Стадия: release candidate** · `gim doctor --release`  
**Version:** `2.0.0` · revision `2026.08.24`

```powershell
node bin/gim.js doctor --release
npm test
npm run test:security
npm run smoke:egress
```

## Что вошло

| Область | Статус |
|---------|--------|
| Colibri Docker default (Win/Linux) | ✅ |
| Native GIM UI + agent tools | ✅ |
| P5 speed (KV slots, grammar, compact prefill) | ✅ |
| P6 security eval (22 scenarios) | ✅ |
| Audit gate 32/32 | ✅ |
| Runtime egress smoke (CI ubuntu) | ✅ |
| Adaptive ctx cap (<64 GB RAM) | ✅ |
| `gim doctor --release` | ✅ |
| Coverage ≥80% gate | ✅ |

## Sign-off (2026-08-24)

- `npm run audit:prebeta` — OK
- `npm run audit:security` — OK
- `npm run test:security` — OK (grade A)
- `npm run smoke:guest` — PASS
- `gim doctor --release` — gate

## Дальше

- [RELEASE.md](./RELEASE.md) · [docs/SPEED.md](./docs/SPEED.md) · [docs/SECURITY-EVAL.md](./docs/SECURITY-EVAL.md)
- Post-2.0: SLSA provenance, external pentest, honest-eval on warm stack
