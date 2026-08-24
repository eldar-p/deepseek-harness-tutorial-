# GIM CLI — 1.1.2 Release

**Version:** `1.1.2`  
**License:** [Apache-2.0](./LICENSE)

Fixes, tuning, skills rework, expanded honest-eval (20 tasks), release gate.

## Pre-tag gate

```powershell
node bin/gim.js doctor --release
npm test
npm run test:coverage
npm run audit:prebeta
npm run audit:security
npm run test:security
npm run smoke:egress
gim start
npm run test:honest
```

## Highlights (1.1.2)

- `gim doctor --release` — pre-tag checklist
- Honest-eval: 8 usefulness + **12 adversarial** (AIShellJack, Trail of Bits, Oso patterns)
- Skills rework for GIM 2.0 workspace (no DSH/Tor legacy)
- Adaptive ctx cap, tool read 8KB, batch tool results
- CI: security gates + egress smoke + honest-eval skip hook

See [CHANGELOG.md](./CHANGELOG.md) · [docs/HONEST-EVAL.md](./docs/HONEST-EVAL.md)
