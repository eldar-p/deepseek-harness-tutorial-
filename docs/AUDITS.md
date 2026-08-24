# Реестр аудитов (32)

Статус: **PASS** | **WARN** | **FAIL** | **N/A** | **DEFER**

Последний прогон: `npm run audit` → [audits/latest.md](./audits/latest.md) · security gate: `npm run audit:security`

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

## Security layer (27–32) — [SECURITY-AUDITS-EXTRA.md](./SECURITY-AUDITS-EXTRA.md)

| # | Аудит | Gate | Отчёт |
|---|-------|------|-------|
| 27 | Supply chain | security | [27-supply-chain](./audits/27-supply-chain.md) |
| 28 | Prompt / tool abuse | security | [28-prompt-jail](./audits/28-prompt-jail.md) |
| 29 | Egress verify | security | [29-egress-verify](./audits/29-egress-verify.md) |
| 30 | Secrets redaction | security | [30-secrets-redact](./audits/30-secrets-redact.md) |
| 31 | Container surface | security | [31-container-surface](./audits/31-container-surface.md) |
| 32 | Update integrity | security | [32-update-integrity](./audits/32-update-integrity.md) |

## Gate по этапам

| Этап | Обязательные аудиты без FAIL |
|------|------------------------------|
| Pre-alpha | 3, 6, 15, 17, 19, 20, **25** |
| Alpha | + 1, 8–14, 16, 18, 21, **23–24, 26** |
| Pre-beta | все **26** (#22 может быть N/A с планом) |
| Security | все **32** |
| Beta+ | все PASS или задокументированный exception |

Adversarial enforcement (не audit gate): `npm run test:security` — [SECURITY-EVAL.md](./SECURITY-EVAL.md)