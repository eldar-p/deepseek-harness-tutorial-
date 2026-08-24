# Release process (pre-alpha → 1.0)

## Pre-alpha

- `0.1.x-prealpha` — **shipped** (`2b91681`)
- Gate: test + coverage 10% + audit pre-alpha + infra

## Alpha — **current tag `v0.2.0-alpha`**

- `0.2.0-alpha`, revision `2026.08.24-alpha`
- Docker guest CI smoke + `smoke:e2e` on maintainer host
- Gate: `npm test` + coverage 30% + `audit:alpha` + `infra:check`
- Install: **git only** (no CDN yet)

```bash
git checkout v0.2.0-alpha
# or stay on main
```

## Beta

- `manifests/cli-releases.json` с url+sha256
- `install-deep.*` тянет CLI с CDN
- Hard egress, coverage ≥50% — [todo/README-beta.md](../../todo/README-beta.md)

## RC / 1.0

- Release gate: все 26 аудитов без FAIL
- Coverage по [VERSION-PLAN.md](../VERSION-PLAN.md)
- THIRD-PARTY и license scan в CI

## Checklist перед тегом

- [x] `npm run infra:check`
- [x] `npm run audit:alpha`
- [x] CHANGELOG entry
- [x] `manifests/channels.json` revision bumped
- [x] ALPHA.md / VERSION-PLAN статус
- [x] `npm run smoke:e2e` PASS
