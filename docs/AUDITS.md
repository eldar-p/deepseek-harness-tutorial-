# Реестр аудитов (26)

Статус: **PASS** | **WARN** | **FAIL** | **N/A** | **DEFER**

Последний прогон: `npm run audit` → [audits/latest.md](./audits/latest.md)

## Базовые (1–22)

| # | Аудит | Gate | Авто | Отчёт |
|---|-------|------|------|-------|
| 1 | Безопасность | alpha | ✓ | [01-security](./audits/01-security.md) |
| 2 | Качество кода и структуры | pre-beta | ✓ | [02-quality](./audits/02-quality.md) |
| 3 | Совместимость и документация | pre-alpha | ✓ | [03-docs-compat](./audits/03-docs-compat.md) |
| 4 | Юридический / лицензии | beta | ✓ | [04-licenses](./audits/04-licenses.md) |
| 5 | Типы и сигнатуры | pre-beta | partial | [05-types](./audits/05-types.md) |
| 6 | Совместимость версий среды | pre-alpha | ✓ | [06-env](./audits/06-env.md) |
| 7 | Производительность и память | beta | manual | [07-performance](./audits/07-performance.md) |
| 8 | Устаревание кода и зависимостей | alpha | ✓ | [08-deps](./audits/08-deps.md) |
| 9 | Чистота дистрибутива | alpha | ✓ | [09-dist](./audits/09-dist.md) |
| 10 | Контейнер и конфигурация | alpha | ✓ | [10-container](./audits/10-container.md) |
| 11 | Границы изоляции / песочница | alpha | ✓ | [11-isolation](./audits/11-isolation.md) |
| 12 | Инсталляторы и права | alpha | ✓ | [12-install](./audits/12-install.md) |
| 13 | Утечки контекста / zero-traces | alpha | ✓ | [13-traces](./audits/13-traces.md) |
| 14 | Холодный старт / CDN | alpha | ✓ | [14-cdn](./audits/14-cdn.md) |
| 15 | Кросс-платформенные пути | pre-alpha | ✓ | [15-paths](./audits/15-paths.md) |
| 16 | GPU / VRAM | alpha | ✓ | [16-gpu](./audits/16-gpu.md) |
| 17 | Индикация / терминал RGB | pre-alpha | ✓ | [17-ui](./audits/17-ui.md) |
| 18 | Интерактивность / TTY | alpha | partial | [18-tty](./audits/18-tty.md) |
| 19 | Обработка ошибок | pre-alpha | ✓ | [19-errors](./audits/19-errors.md) |
| 20 | Контекстная помощь | pre-alpha | ✓ | [20-help](./audits/20-help.md) |
| 21 | Несколько стеков | alpha | partial | [21-multistack](./audits/21-multistack.md) |
| 22 | Деградация контекста (session) | beta | DEFER | [22-context](./audits/22-context.md) |

## Дополнительные (23–26) — [аудитыдоп]

| # | Аудит | Gate | Авто | Отчёт |
|---|-------|------|------|-------|
| 23 | Завершение и прерывания | alpha | ✓ | [23-shutdown](./audits/23-shutdown.md) |
| 24 | Диск I/O и износ | alpha | ✓ | [24-disk-io](./audits/24-disk-io.md) |
| 25 | Телеметрия и приватность | pre-alpha | ✓ | [25-telemetry](./audits/25-telemetry.md) |
| 26 | Деградация моделей (квантование) | alpha | ✓ | [26-quant-degrade](./audits/26-quant-degrade.md) |

## Gate по этапам

| Этап | Обязательные аудиты без FAIL |
|------|------------------------------|
| Pre-alpha | 3, 6, 15, 17, 19, 20, **25** |
| Alpha | + 1, 8–14, 16, 18, 21, **23–24, 26** |
| Pre-beta | все **26** (#22 может быть N/A с планом) |
| Beta+ | все PASS или задокументированный exception |