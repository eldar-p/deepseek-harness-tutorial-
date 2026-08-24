# План версий Deep CLI

Канон из аудита планирования (24.08.26). Критерий перехода — **покрытие тестами** + прохождение аудитов этапа.

| # | Этап | Версия (semver) | Смысл | Покрытие | CI / OS |
|---|------|-----------------|-------|----------|---------|
| 1 | **Pre-alpha** | `0.1.x-prealpha` | MVP: CLI skeleton, llama spawn, DSH, materialize | **≥10%** | GitHub Actions: ubuntu + macos + windows (doctor, test, audit) |
| 2 | **Alpha** | `0.2.x-alpha` | Нестабильный, не полностью безопасный; guest + jail | **≥30%** | + smoke start/stop на runner с Docker |
| 3 | **Pre-beta** | `0.3.x-prebeta` | Полный аудит альфы, структура и качество продукта | **≥50%** | Все 22 аудита — green или задокументированный defer |
| 4 | **Beta** | `0.4.x-beta` | Реальные OS, разбор полевых ошибок | **≥60%** | Nightly на 3 OS + manual matrix |
| 5 | **RC** | `0.9.x-rc` | Блокеры закрыты; остаётся эффективность | **≥70%** | Release gate |
| 6 | **0.5** | `0.5.x` | Последние изменения ядра | **≥90%** | Strict coverage fail |
| 7 | **1.0** | `1.0.0` | Полностью рабочий продукт | **≥100%** | Signed releases, CDN manifests |

> В исходном аудите пункт 3 назван «преальфа» — трактуем как **Pre-beta** (аудит альфы перед бета-каналом).

## Текущий этап

**Pre-alpha** (`0.1.0-prealpha`) — **complete** (readiness 100/100, Aug 2026).

- [x] llama fetch/spawn + health
- [x] DSH web + settings → llama
- [x] guest-exec plugin materialize
- [x] Guest GREEN (Docker Desktop + mount smoke)
- [x] Покрытие ≥10% (src ~58%, gate 10%)
- [x] `npm run audit` без FAIL (gate pre-alpha: **7** аудитов, всего **26**)

**Следующий этап:** Alpha (`0.2.x-alpha`) — см. [../todo/README.md](../todo/README.md) и [../adr/README.md](../adr/README.md).

**Alpha** (`0.2.0-alpha`) — **complete** (tag `v0.2.0-alpha`, Aug 2026).

- [x] Jail + memory + compact/prune
- [x] Coverage 30% gate (~69% src)
- [x] CI smoke-guest + audit:alpha
- [x] `doctor --readiness --stage=alpha`
- [x] Multi-stack (`deep stacks`, GPU lock)
- [x] Network allowlist env (hard proxy → beta)
- [x] `npm run smoke:e2e` PASS
- [x] Tag `v0.2.0-alpha`

**Следующий этап:** Pre-beta / Beta — [todo/README-beta.md](../todo/README-beta.md)

- [x] Coverage gate ≥50% (src ~69%)
- [x] Audit #18 TTY PASS
- [x] Hard egress iptables (010)
- [x] Audit #22 context (011)
- [x] CDN publish path + install shim (013); zip on GitHub Release
- [x] Pre-beta audit gate (015) — `npm run audit:prebeta` 0 FAIL
- [x] Extra proc/llama/shutdown tests (016)
- [x] Checksum sidecars (017) + `parseArgs` tests (018)
- [x] Version bump `0.3.0-prebeta`
- [x] Nightly CI workflow (3 OS)
- [x] Field beta: gpu-lock/dsh tests (019), coverage gate 60% (020)
- [x] Version bump `0.4.0-beta`
- [x] RC readiness `0.9.0-rc.0` (021), coverage gate 70%

**Текущий этап:** RC (`0.9.0-rc.0`) — readiness **100/100**. Next: CDN Release upload, field matrix sign-off → `0.5` / `1.0`.

```bash
npm test
npm run test:coverage    # ≥70%
npm run audit:prebeta
node bin/deep.js doctor --readiness --stage=rc
```
