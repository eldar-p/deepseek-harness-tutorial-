# План версий GIM CLI

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

**Текущий этап:** `2.0.0` — GIM CLI product (Colibri Docker default, native UI, security eval P6).

Статус alpha: [ALPHA.md](../ALPHA.md) · аудиты: [AUDITS.md](./AUDITS.md) · OS: [OS-COMPAT.md](./OS-COMPAT.md)

```bash
npm test
npm run test:coverage
npm run audit:prebeta
npm run test:security
node bin/gim.js doctor --readiness --stage=alpha
```
