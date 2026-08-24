# Дополнительные security-аудиты (сверх 1–26)

**Контекст:** gate `npm run audit:prebeta` закрывает **26/26** (см. `docs/AUDIT-STATUS.md`, `scripts/audit-run.mjs`).  
Этот документ — **следующий слой**: угрозы, которые базовые аудиты покрывают слабо или только документально. Нумерация условная **27+** для будущего расширения `audit-run.mjs`.

Не заменяет пентест; это чеклист PASS/FAIL для автоматизации.

---

## 27. Supply chain

### Угрозы

| Вектор | Риск |
|--------|------|
| **npm** | Сейчас `0` runtime deps — хорошо; регресс при добавлении deps; `dsh` ставится глобально отдельно |
| **GGUF downloads** | Пользователь указывает путь; любой будущий auto-fetch модели без pin = подмена весов |
| **llama / zip CDN** | `manifests` + `.sha256` / `sha256Url`; MITM или подмена Release без проверки |
| **Guest image layers** | Dockerfile.guest + tag; без digest pin — drift/supply attack |

### PASS / FAIL (автоматизируемо)

| ID | Проверка | PASS если |
|----|----------|-----------|
| 27.1 | `package.json` dependencies / optionalDependencies пусты (или allowlist) | нет неожиданных runtime deps |
| 27.2 | `package-lock` / отсутствие lock согласовано с политикой | политика зафиксирована в аудите 8 |
| 27.3 | Все URL в `manifests/*.json` имеют `sha256` (не null) для release-каналов | pin обязателен |
| 27.4 | `pack-release` пишет sidecar `.sha256`; `deep update` отказывается без match | verify path в коде |
| 27.5 | Guest image tag + digest (или build from pinned Dockerfile hash) задокументированы | нет «latest» без pin |
| 27.6 | Предупреждение/FAIL если GGUF fetch URL появился без checksum API | нет голого HTTP model pull |

---

## 28. Prompt injection / tool abuse в DSH guest

### Угрозы

- Вредоносный контент в файлах workspace / memory → модель вызывает tools.
- Plugin `guest-bash-local`: shell в контейнере; jail обход через symlink, `..`, абсолютные пути.
- Попытка заставить агента читать хост-секреты через смонтированные пути вне workspace.

### PASS / FAIL

| ID | Проверка | PASS если |
|----|----------|-----------|
| 28.1 | Host shell для агента выключен (нет pwsh/bash tool на host) | isolation invariant |
| 28.2 | Все FS tools идут через `workspace-jail` rewrite | jail покрыт тестами (`test/jail.test.js`) |
| 28.3 | Smoke: попытка `../` / абсолютный путь вне workspace → отказ | e2e или unit |
| 28.4 | Guest exec только bash в контейнере; нет docker.sock mount в guest | Dockerfile / run args |
| 28.5 | Документ threat model: «prompt injection ≠ bypass jail» | ADR или SECURITY note |
| 28.6 | Опционально: набор adversarial prompts в `smoke:e2e` (не в unit gate) | хотя бы 3 сценария |

---

## 29. Network egress allowlist — верификация

### Угрозы

- Preset `open` = полный egress (осознанный WARN).
- `allowlist` / `deep-net-enforce` не применился (нет NET_ADMIN, сломан entrypoint).
- DNS/IP bypass (прямой IP, DoH, IPv6).

### PASS / FAIL

| ID | Проверка | PASS если |
|----|----------|-----------|
| 29.1 | Manifest `allowlists.json` парсится; preset → непустой список для allowlist | readiness `allowlist` |
| 29.2 | Guest env: `DEEP_NET_MODE` + domains передаются | `guestNetworkEnv` |
| 29.3 | Runtime: из guest `curl` к домену вне списка → fail; к allow → ok (или offline → все fail) | smoke с контейнером |
| 29.4 | Preset `offline` / `network=none` → нет маршрута наружу | проверяемо |
| 29.5 | Preset `open` → явный WARN в status/doctor | не тихий open |
| 29.6 | Нет docker `--network host` для guest в default path | grep run args |

---

## 30. Secrets / log redaction

### Угрозы

- Промпты, API keys, содержимое `.env` в логах стека.
- Трассировки DSH / cordis с телами сообщений при «events only» политике.
- Утечка в crash dumps / status one-screen.

### PASS / FAIL

| ID | Проверка | PASS если |
|----|----------|-----------|
| 30.1 | Нет хардкода секретов в `src/` / `bin/` (regex token/key) | аудит 1 + расширенный regex |
| 30.2 | Лог-API принимает только redacted events (комментарий/контракт в `paths.js`) | статический grep на log helpers |
| 30.3 | `.env` / `env.example` в gitignore policy; example без реальных значений | файловая проверка |
| 30.4 | Zero-traces / wipe не копирует prompt bodies в артефакты | политика + тест |
| 30.5 | `PRIVACY.md` согласован с дефолтом telemetry off | аудит 25 + link check |

---

## 31. Container escape / mount surface

### Угрозы

- Лишние mounts: docker.sock, `$HOME`, `/var/run`, host devices.
- `NET_ADMIN` + слабый iptables script = не escape, но сеть.
- Privileged / pid host / cap-add лишнее.

### PASS / FAIL

| ID | Проверка | PASS если |
|----|----------|-----------|
| 31.1 | Run args guest: только workspace (+ нужное read-only) | allowlist mounts |
| 31.2 | Нет `--privileged`; caps минимизированы (NET_ADMIN только если allowlist) | статический разбор `startGuest` |
| 31.3 | Нет mount docker.sock в guest | FAIL при обнаружении |
| 31.4 | User в контейнере не root *если возможно* (или documented exception) | Dockerfile USER |
| 31.5 | Smoke: из guest нельзя писать вне `/workspace` на host | e2e |

---

## 32. Update path integrity

### Угрозы

- `deep update` тянет zip без sha256 / с подменённым `sha256Url`.
- Канал edge/beta указывает на чужой URL.
- Отсутствие GPG/cosign (известно; trust = pin).

### PASS / FAIL

| ID | Проверка | PASS если |
|----|----------|-----------|
| 32.1 | Перед установкой zip обязателен локальный или sidecar sha256 match | код update |
| 32.2 | `cli-releases.json`: для published channels sha256 не null | манифест |
| 32.3 | `DEEP_CLI_ZIP` тоже проходит verify (не bypass) | тест |
| 32.4 | Отказ при mismatch — non-zero exit, без частичной установки | поведение |
| 32.5 | Документирован отсутствие cosign; roadmap не выдаёт «signed» | RELEASE.md honesty |
| 32.6 | Manifest cache path не исполняет произвольный JS из CDN | только zip extract allowlist |

---

## Карта → будущий `scripts/audit-run.mjs`

Предлагаемые slug'и (после 26):

```text
27 supply-chain
28 prompt-tool-abuse
29 egress-verify
30 secrets-redaction
31 container-escape
32 update-integrity
```

Минимальная автоматизация (без живого Docker):

- 27.1–27.4, 29.1–29.2, 29.5–29.6, 30.1–30.3, 31.1–31.3, 32.1–32.2, 32.5 — **static** в `audit-run.mjs`.
- 28.2–28.3, 29.3–29.4, 31.5, 32.3–32.4 — **test/smoke** (`npm test`, `smoke:guest`, `smoke:e2e`); gate может требовать файл-маркер или skip без Docker.

Gate proposal:

| Gate | Новые обязательные |
|------|-------------------|
| pre-beta (нынешний) | без изменений (1–26) |
| **rc** / **1.0-security** | static 27–32 subset |
| **field** | + Docker egress + jail e2e |

Отчёт класть в `docs/audits/27-….md` по аналогии с существующими 01–26.

---

## Связь с текущими аудитами

| Уже есть | Что не хватает (этот doc) |
|----------|---------------------------|
| 01 security, 08 deps, 14 CDN | полный supply chain + guest digest |
| 11 isolation, 10 container | escape surface + adversarial tools |
| allowlist readiness | **runtime** egress verify |
| 25 telemetry, log policy | систематический redaction grep |
| update + sha256 | bypass/`sha256Url` threat tests |
