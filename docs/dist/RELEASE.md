# Release process (pre-alpha → 1.0)

## Pre-alpha (сейчас)

- Версия в `package.json`: `0.1.x-prealpha`
- **Нет** npm publish / CDN
- Gate: `npm test` + `npm run test:coverage` + `npm run audit` + `npm run infra:check`
- Коммиты на `main` по запросу maintainer

## Alpha

- `0.2.x-alpha`, Docker guest обязателен в CI smoke
- Draft GitHub Release с артеfact checklist (без CDN или staging CDN)

## Beta

- `manifests/cli-releases.json` с url+sha256
- `install-deep.*` тянет CLI с CDN
- Signed checksums file per release

## RC / 1.0

- Release gate: все 26 аудитов без FAIL
- Coverage по [VERSION-PLAN.md](../VERSION-PLAN.md)
- THIRD-PARTY и license scan в CI

## Checklist перед любым тегом

- [ ] `npm run infra:check`
- [ ] `npm run audit -- --gate=alpha` (когда alpha)
- [ ] CHANGELOG entry (unreleased section)
- [ ] `manifests/channels.json` revision bumped
- [ ] PRE-ALPHA / README статус обновлён
