# Аудиты и статус продукта (перепрогон 2026-08-24)

## Полный прогон: 26/26 PASS

Команда: `npm run audit:prebeta` (gate = все аудиты из твоих списков + доп.).

| # | Аудит | Статус | Комментарий |
|---|-------|--------|-------------|
| 1 | Безопасность | PASS | нет секретов в коде; root refuse; log policy |
| 2 | Качество и структура | PASS | 22 модуля `src/` |
| 3 | Документация | PASS | README / INSTALL / RELEASE / CORE / RC |
| 4 | Лицензии | PASS | CC-BY-NC-SA-4.0 |
| 5 | Типы и сигнатуры | PASS | JSDoc частично; TS отложен (`docs/TYPES.md`) |
| 6 | Версии среды | PASS | Node ^22.19 / ≥24 |
| 7 | Производительность | PASS | health timeouts; глубокий profiling — later |
| 8 | Зависимости | PASS | 0 runtime npm deps |
| 9 | Дистрибутив | PASS | `files` в package.json чистый |
| 10 | Контейнер | PASS | Dockerfile.guest + manifest |
| 11 | Изоляция | PASS | guest-exec; jail; pwsh off |
| 12 | Инсталляторы | PASS | install scripts |
| 13 | Zero-traces | PASS | soft/hard; wipe workspace guarded |
| 14 | CDN / manifests | PASS | sha256 pinned |
| 15 | Кросс-платформенные пути | PASS | Win helpers |
| 16 | GPU | PASS | detect + lock |
| 17 | Терминал RGB | PASS | status one-screen |
| 18 | Интерактивность / TTY | PASS | isTTY checks |
| 19 | Ошибки | PASS | exitCode |
| 20 | Помощь | PASS | `deep help` |
| 21 | Multi-stack | PASS | `--name` / stacks |
| 22 | Деградация контекста | PASS | compact/prune в cordis |
| 23 | Завершение (SIGINT) | PASS | shutdown handlers |
| 24 | Диск I/O | PASS | rotate + `.part` cleanup |
| 25 | Телеметрия / privacy | PASS | off + PRIVACY.md |
| 26 | Деградация квантования | PASS | Q4 baseline; WARN на Q3− |

**Итог gate:** FAIL 0 · WARN 0

Дополнительно сейчас: **139** unit-тестов PASS · coverage **~83%** (gate 80%) · readiness `1.0` **100/100**.

---

## Что уже работает

| Область | Доказательство |
|---------|----------------|
| CLI команды | `doctor`, `bootstrap`, `start/stop/status`, `stacks`, `update`, `presets`, `help` |
| Docker engine | `doctor`: docker OK |
| GPU detect | RTX 4070 Ti SUPER |
| Llama binary | найден в `~/.deep/runtime/llama/...` |
| GGUF | путь в config (Qwen3-4B Q4_K_M) |
| DSH на PATH | npm global `dsh` |
| Guest image / iptables allowlist | образ + `deep-net-enforce` (проверено ранее GREEN) |
| Multi-stack + GPU lock | код + тесты |
| Workspace jail | plugin + materialize |
| CDN pack path | `dist/deep-cli-1.0.0.zip` + `.sha256` локально |
| Update from local zip | `DEEP_CLI_ZIP` + verify sha256 |
| Windows field | ранее: Engine/Guest/Llama/DSH все GREEN |
| CI / nightly | workflows в репо |
| Аудиты 1–26 | автопрогон зелёный |

---

## Что не работает / дыры

| Проблема | Важность | Что делать |
|----------|----------|------------|
| **GitHub Release v1.0.0 не залит** (нет `gh auth`) | Высокая | `gh auth login` → upload zip+sha256; без этого `deep update` с CDN даёт **404** |
| **Стек сейчас остановлен** (Guest/Llama/DSH RED) | Норма | `deep start` — поднять снова |
| **Тесты засоряют `deep stacks`** (`utest-*`) | Средняя | чистить `~/.deep/config.json` stacks / run dirs после тестов; улучшить teardown |
| macOS / Linux field не подписаны | Средняя | чеклист в `RC.md` ещё open |
| GPG/cosign подписи нет | Низкая | trust = sha256 pin (как в RELEASE.md) |
| Coverage не 100% (план 1.0 мечтал о 100%) | Низкая | ~83%; `cmdStart`/spawn — через smoke/e2e, не unit |
| Profiling памяти (аудит 7 deep) | Низкая | сознательно deferred |
| TypeScript | Низкая | JSDoc policy, не TS |
| `docker` не в системном PATH | Косметика | Deep находит через `engineEnv` / known paths |

---

## Быстрый чеклист «живой» машины

```powershell
npm run audit:prebeta          # 26/26
npm test                       # 139
node bin/deep.js doctor --readiness --stage=1.0
node bin/deep.js start         # поднять стек
node bin/deep.js status        # ждать GREEN
```

CDN после логина:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" release create v1.0.0 `
  dist\deep-cli-1.0.0.zip dist\deep-cli-1.0.0.zip.sha256 `
  --title "Deep CLI v1.0.0" --notes "See RELEASE.md" --target main
```
