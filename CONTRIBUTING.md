# Contributing to GIM CLI

Спасибо за интерес к проекту. Pre-alpha: малые PR, один concern на change.

## Dev setup

```bash
git clone https://github.com/eldar-p/gim-cli.git
cd gim-cli
npm link
npm test
npm run audit
npm run infra:check
```

## Branches

- `main` — integration (maintainer-driven pre-alpha)
- Feature branches по договорённости

## Before PR

1. `npm test` — all green
2. `npm run test:coverage` — src/ ≥ gate for stage
3. `npm run audit -- --gate=pre-alpha` (or alpha when ready)
4. No secrets, no machine-specific paths in public docs
5. Update docs if behavior changes

## Scope

- **GIM CLI** (`src/`, `bin/`, `manifests/`, `docs/`) — primary

## Code style

- Match existing JS (ESM, minimal deps)
- No prompt text in logs
- Prefer small focused diffs

## Issues

Use GitHub issue templates: bug / feature. Include OS, Node version, `gim doctor` output.

## Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

Contributions are accepted under [Apache-2.0](./LICENSE) (same as the project). By opening a PR you agree your contribution is licensed under those terms.
