# Deep CLI — Pre-alpha 0.1.0

**Стадия: complete (100% readiness)** — llama + DSH + guest **GREEN**

```powershell
node bin/deep.js doctor --readiness   # текущий %
```

| Зона | Прогресс | Комментарий |
|------|----------|-------------|
| Код / CLI | 100% | doctor, bootstrap, start/stop/status, update, presets |
| Llama | 100% | fetch, spawn, health, quant WARN |
| DSH | 100% | web + settings; materialize + cordis |
| Guest | 100% | Docker Desktop + `deep-guest:prealpha`, mount smoke OK |
| Тесты / CI | ~80% | 31 tests, src ~58%, CI 3 OS |
| Аудиты (26) | ~75% | pre-alpha gate OK; alpha items частично |
| Инфраструктура | 100% | docs, legal, community, manifests scaffold |
| CDN / publish | ~10% | git install only |

**Критерий «pre-alpha complete» (85%+ readiness):** ✅ guest smoke GREEN + полный цикл start→status→stop.

## Проверить стадию

```powershell
node bin/deep.js doctor --readiness
node bin/deep.js status
```

## Что работает

| Компонент | Статус |
|-----------|--------|
| llama fetch/spawn + health | OK |
| DSH web → llama | OK |
| guest-exec materialize | OK |
| Guest container (Docker) | OK |
| Тесты + audit + infra | OK |

## Быстрый старт

```powershell
# 1. Docker Desktop — установить, запустить, дождаться «Engine running»
powershell -File .\scripts\wait-docker.ps1

# 2. Bootstrap + старт
node bin/deep.js bootstrap --gguf "PATH\to\model.gguf"
node bin/deep.js start --cpu
node bin/deep.js status
node bin/deep.js stop
```

Первый `start` собирает образ `deep-guest:prealpha` (~1 мин). DSH и llama получают случайные порты (см. вывод `status`).

## Quality gates

```bash
npm test
npm run test:coverage
npm run audit
npm run infra:check
```

Документация: [docs/README.md](./docs/README.md) · [INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md)

## До Alpha

1. Покрытие ≥30%, audit gate alpha
2. compact/prune/memory
3. Полный jail + smoke на CI runner с Docker
