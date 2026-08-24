# Snap Store — чеклист публикации Deep CLI

**Цель:** выложить готовый Node CLI (`deep`) в [Ubuntu Snap Store](https://snapcraft.io/).  
**Реальность продукта:** Deep CLI = Node 22+ CLI + опционально Docker guest + llama.cpp + DSH. Основной field sign-off — **Windows + Docker Desktop**; Snap — **только Linux**.

Не делать: `gh auth`, upload Release — вне этого документа.

---

## 1. Snapcraft basics

| Шаг | Действие |
|-----|----------|
| 1 | Аккаунт на snapcraft.io + согласование имени snap (например `deep-cli`) |
| 2 | `snapcraft.yaml` в корне или `snap/` |
| 3 | Base: `core24` (или `core22`) под целевой Ubuntu |
| 4 | App: команда `deep` → entry `bin/deep.js` через node runtime |
| 5 | Сборка: `snapcraft` локально или в CI (`snapcore/action-build`) |
| 6 | Upload: `snapcraft upload *.snap --release=edge` |
| 7 | Продвижение: edge → beta → candidate → stable после review |

**Адаптация под Deep CLI:**

- **Part `deep`:** скопировать `bin/`, `src/`, `manifests/`, `assets/`, `presets/`, `LICENSE`, docs по необходимости (см. `package.json` `files`).
- **Part `node`:** либо snap `nodejs` content/interface, либо stage Node binary (фиксировать major: ^22.19 / ≥24).
- **Не паковать** целиком Docker Engine / GPU-драйверы / GGUF — это runtime deps хоста.
- Опционально: `adapters`/`hooks` с проверкой `docker` и понятным сообщением «установи Docker / rootless / podman».

Минимальный каркас идей (не готовый yaml):

```yaml
name: deep-cli
base: core24
version: '1.0.1'
summary: Local llama.cpp + Docker guest + DSH orchestrator
description: |
  Deep CLI поднимает локальный стек агента: llama-server, deep-guest, DSH.
  Требует Docker (или совместимый engine) на хосте для guest.
grade: devel          # stable только после review + field Linux
confinement: strict   # classic — только если strict нереалистичен

apps:
  deep:
    command: bin/deep-wrapper
    plugs: [network, network-bind, home, removable-media]
    # docker: см. раздел interfaces
```

---

## 2. Confinement: strict vs classic

| Режим | Когда | Для Deep CLI |
|-------|-------|--------------|
| **strict** | Предпочтительно для Store; sandbox + interfaces | Цель по умолчанию |
| **classic** | Нужен произвольный доступ к FS/процессам как у deb | Избегать; Store жёстче ревьюит; justification обязателен |

Deep трогает `~/.deep/`, spawns процессов, говорит с Docker socket — **strict возможен**, но потребует аккуратных plugs и, вероятно, docker interface / slot на сокете. Classic — только если докажете, что иначе guest/llama нежизнеспособны.

---

## 3. Interfaces (plugs)

| Interface | Зачем Deep | Обязательность |
|-----------|------------|----------------|
| `network` / `network-bind` | llama/DSH на 127.0.0.1, fetch manifests/llama zip | Да |
| `home` | `~/.deep` config, workspace, runtime | Да (или `personal-files` с декларацией путей) |
| `removable-media` | GGUF с внешних дисков | Опционально |
| **docker** | Управление guest-контейнерами | Если guest — часть snap-сценария: нужен plug к docker socket; часто **ручной connect** `snap connect deep-cli:docker` |
| `opengl` / GPU | Проброс GPU в контейнер / llama | Сложно; часто **вне snap** (пользователь ставит NVIDIA + docker nvidia) |
| `process-control` / `system-observe` | doctor / GPU detect | Только по необходимости + review |

**Честно:** Docker Desktop на Windows ≠ Docker на Ubuntu. Snap-пользователь ожидает `docker.io` / Docker CE / rootless. Документировать `snap connect` и минимальную версию Engine.

---

## 4. Metadata и лицензия

Обязательное в Store / snapcraft:

- `name`, `title`, `summary` (≤79), `description`
- `license` (SPDX)
- `website`, `contact` / `issues`
- Иконка 512×512, screenshots
- Категории (например development / utilities)

### ⚠️ CC BY-NC-SA 4.0 vs Snap Store

Проект сейчас: **CC-BY-NC-SA-4.0** (NonCommercial + ShareAlike).

- Snap Store рассчитан на распространение ПО конечным пользователям, в т.ч. через каналы, где коммерческое использование пакета и инфраструктуры Canonical — **серая зона** относительно NC.
- Многие snap — MIT/Apache/GPL; **NC-лицензии часто конфликтуют** с ожиданиями Store (redistribution, коммерческие пользователи Ubuntu).
- **Блокер / флаг:** перед публикацией — юридическая проверка: либо смена лицензии на OSI-friendly для snap-артефакта, либо явный отказ от Store и только GitHub zip / self-hosted, либо отдельный «docs-only» snap без претензии на commercial-friendly.

Не публиковать stable, пока лицензионный вопрос не закрыт письменно.

---

## 5. Security review expectations

| Тип | Что проверяют | Подготовка Deep |
|-----|---------------|-----------------|
| **Automated review** | `snapcraft` lint, объявленные plugs, опасные confinement, бинарники | Чистый `snapcraft.yaml`, без classic без нужды |
| **Manual review** | Зачем docker/home/classic; не скрытый root; update path | README: security model (guest-only tools, allowlist, 127.0.0.1) |
| **Store policy** | Нет malware, честное описание deps (Docker, GPU) | В description: «requires Docker»; не обещать no-deps |

Ожидайте задержку на **первый** upload с docker-related plugs.

---

## 6. CI build tips

- GitHub Actions: `snapcore/action-build` на `ubuntu-latest` / LTS.
- Артефакт `.snap` → artifact; upload в Store только с secrets `SNAPCRAFT_STORE_CREDENTIALS` (не в этом репо-таске).
- Матрица: amd64 обязательно; arm64 — если llama/guest реально поддерживаете.
- Не гонять полный GPU e2e в Snap CI — достаточно `deep doctor` + unit/audit без Docker GPU.
- Версия snap = semver продукта (`1.0.1`); channel mapping отдельно.

---

## 7. Channels

| Channel | Назначение для Deep |
|---------|---------------------|
| **edge** | Каждый CI / nightly Linux pack |
| **beta** | После Linux field smoke (Engine + guest + llama CPU) |
| **candidate** | Freeze перед stable; ручной soak |
| **stable** | Только после Store review + лицензия OK + Linux field GREEN |

Аналог внутренних каналов: см. `docs/dist/CHANNELS.md` (stable/beta/edge продукта ≠ автоматически Snap channels, но имена можно выровнять).

---

## 8. Честные блокеры для Deep CLI

| Блокер | Почему больно для Snap |
|--------|------------------------|
| **Windows-first field** | Snap не доставляет ценность основному проверенному хосту |
| **Docker Desktop guest** | На Linux нужен нативный Docker; путь Windows Desktop в коде — не snap-story |
| **GPU lock / NVIDIA** | Проброс GPU в snap+docker — отдельный ops-ад; CPU-only snap реалистичнее как MVP |
| **GGUF + llama binary** | Большие артефакты; лучше prefetch как сейчас (manifests + sha256), не раздувать snap до гигабайт |
| **DSH global npm** | Зависимость `@deepseek-ai/dsh` вне snap — упаковать peer или документировать `npm i -g` |
| **CC BY-NC-SA** | Риск отклонения / несовместимости с коммерческими ожиданиями Store |
| **Classic temptation** | `~/.deep` + docker.sock + spawn — ревьюеры спросят «почему не strict» |

### Рекомендуемый путь MVP Snap

1. Закрыть лицензию для Store.  
2. strict snap: CLI + manifests; Docker **с хоста**; CPU llama.  
3. edge only, пока нет Linux field sign-off как у Windows.  
4. Не обещать GPU в Store listing до отдельного ADR.

---

## 9. Чеклист «готово к upload»

- [ ] `snapcraft.yaml` strict, без лишних plugs  
- [ ] Wrapper: `node` найден, `DEEP_*` paths под `$SNAP_USER_COMMON` / home  
- [ ] `deep doctor` на чистой Ubuntu VM без GPU  
- [ ] Документация: Docker install + `snap connect`  
- [ ] License / Store legal OK  
- [ ] CI собирает `.snap`  
- [ ] Listing: screenshots, «requires Docker», non-commercial disclaimer если NC остаётся  
- [ ] Первый релиз только в **edge**
