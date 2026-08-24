# Audit run 2026-08-24

Gate: **alpha**

| # | Аудит | Статус | Детали |
|---|-------|--------|--------|
| 1 | Безопасность | PASS | No hardcoded secrets; root refuse; log policy |
| 2 | Качество и структура | PASS | 20 src modules |
| 3 | Документация | PASS | Core docs present |
| 4 | Лицензии | PASS | package: MIT |
| 5 | Типы и сигнатуры | N/A | JS only pre-alpha; TS deferred to pre-beta |
| 6 | Версии среды | PASS | node ^22.19.0 // >=24.0.0 |
| 7 | Производительность | N/A | Manual profiling at beta |
| 8 | Зависимости | PASS | Zero runtime npm deps (CLI only) |
| 9 | Дистрибутив | PASS | files: bin, src, manifests, assets, presets, docs, LICENSE, CHANGELOG.md |
| 10 | Контейнер | PASS | Dockerfile.guest + manifest |
| 11 | Изоляция | PASS | guest-exec; pwsh disabled |
| 12 | Инсталляторы | PASS | install scripts + log mode |
| 13 | Zero-traces | PASS | soft/hard hooks; workspace wipe guarded |
| 14 | CDN / manifests | PASS | CPU win sha256 pinned |
| 15 | Кросс-платформенные пути | PASS | Win path helpers present |
| 16 | GPU | PASS | detect + lock file |
| 17 | Терминал RGB | PASS | status-ui one-screen |
| 18 | Интерактивность | PASS | TTY checks in cli |
| 19 | Ошибки | PASS | Structured exitCode |
| 20 | Помощь | PASS | deep help command |
| 21 | Multi-stack | PASS | listStacks + --name |
| 22 | Деградация контекста | N/A | Compact/prune enforcement deferred to beta (t6) |
| 23 | Завершение и прерывания | PASS | SIGINT/SIGTERM → stop stacks; emergency; GPU lock release |
| 24 | Диск I/O и износ | PASS | log rotate 512KiB; stale .part cleanup; atomic downloads |
| 25 | Телеметрия и приватность | PASS | telemetry off; PRIVACY.md; no prompt logs |
| 26 | Деградация квантования | PASS | Q4_K_M baseline; WARN on Q3 and below at start |

## Gate summary

- FAIL: 0
- WARN: 0

**Gate alpha: OK** (no FAIL)
