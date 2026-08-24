# GIM CLI — гайд для новичков

> **Для кого:** первый запуск GIM на своём ПК.  
> **Время:** 30–60 мин (больше — если качаете Docker и GGUF).  
> Опытным пользователям: [README.md](./README.md) · [docs/INSTALL.md](./docs/INSTALL.md).

---

## Содержание

1. [Что вы ставите](#1-что-вы-ставите)
2. [Выберите ОС](#2-выберите-ос)
3. [Общие правила (все ОС)](#3-общие-правила-все-ос)
4. [Windows](#4-windows)
5. [Linux](#5-linux)
6. [macOS](#6-macos)
7. [Три способа подключить «мозг»](#7-три-способа-подключить-мозг)
8. [Запуск и остановка](#8-запуск-и-остановка)
9. [FAQ — только реальные ошибки](#9-faq--только-реальные-ошибки)
10. [Шпаргалка](#10-шпаргалка)

---

## 1. Что вы ставите

GIM CLI — оркестратор на **вашем** компьютере:

| Часть | Назначение |
|-------|------------|
| **LLM** | Отвечает в чате (локальный GGUF, Colibri в Docker, или облачный API) |
| **Guest (Docker)** | Песочница: агент выполняет bash только внутри контейнера |
| **GIM UI** | Веб-интерфейс на `127.0.0.1` (поднимается при `gim start`) |

Команды вводятся в **терминале** (cmd, PowerShell, bash). Это не чат с Windows — только команды вида `gim doctor`.

---

## 2. Выберите ОС

| ОС | Раздел | LLM по умолчанию в продукте |
|----|--------|----------------------------|
| **Windows** | [§4](#4-windows) | Colibri Docker *или* явно `--gguf` / `--api` |
| **Linux** | [§5](#5-linux) | то же |
| **macOS** | [§6](#6-macos) | **нет** Colibri Docker → `--gguf` или `--api` |

**Почему раньше не было Linux:** первый черновик гайда писался под Windows. Linux и macOS — полноценные платформы (CI гоняет ubuntu + macos + windows). Отдельный каталог: [docs/LINUX.md](./docs/LINUX.md) · [MACOS.md](./MACOS.md).

---

## 3. Общие правила (все ОС)

### Пути без кириллицы и пробелов

Docker монтирует папки в Linux-контейнер. Пути с пробелами и non-ASCII часто ломают guest:

| Плохо | Хорошо |
|-------|--------|
| `C:\Мои проекты\gim` | `C:\ai\gim` |
| `~/Desktop/моя модель.gguf` | `~/ai/models/model.gguf` |

### Node.js обязателен

```bash
node --version   # нужно v22.19+ или v24+
```

Без Node дальше нет смысла.

### Docker — для guest

Engine должен быть **запущен** (Docker Desktop или `systemctl start docker`), не только «установлен вчера».

### Не спамить Ctrl+C

Один Ctrl+C прерывает текущую команду. После прерывания `start` всё равно выполните `gim stop`, иначе порты и контейнеры останутся висеть.

### Не запускать от root

`gim start` от root **отказывает** — используйте обычного пользователя (на Linux добавьте себя в группу `docker`).

---

## 4. Windows

### 4.1 Установить

1. **Node.js LTS / 22+** — https://nodejs.org/ (галочка **Add to PATH**).
2. **Git** (опционально) — https://git-scm.com/download/win или ZIP с GitHub.
3. **Docker Desktop** — https://www.docker.com/products/docker-desktop/  
   Включите **WSL 2**, дождитесь **Engine running**.

Проверка:

```powershell
node --version
docker version
```

При необходимости: `powershell -File .\scripts\wait-docker.ps1`

### 4.2 Папки

```text
C:\ai\gim\          ← репозиторий (git clone)
C:\ai\models\       ← GGUF, если локальная модель
```

### 4.3 Скачать проект

```powershell
cd C:\ai
git clone https://github.com/eldar-p/gim-cli.git gim
cd gim
```

### 4.4 Проверка

```powershell
node bin/gim.js doctor
```

Engine должен быть **GREEN**. Если RED — Docker Desktop не запущен.

---

## 5. Linux

Подробнее: **[docs/LINUX.md](./docs/LINUX.md)** (Ubuntu/Debian, Fedora, WSL).

### 5.1 Установить

```bash
# Node 22+ (nodesource или nvm — см. LINUX.md)
node --version

# Docker Engine + ваш пользователь в группе docker
sudo usermod -aG docker "$USER"
# перелогиниться, затем:
docker version
```

**WSL на Windows:** предпочтительно **Docker Desktop → WSL integration**, а не отдельный apt-docker без Desktop (два разных daemon — типичная ловушка).

### 5.2 Папки

```bash
mkdir -p ~/ai/models
git clone https://github.com/eldar-p/gim-cli.git ~/ai/gim
cd ~/ai/gim
```

### 5.3 DSH (если понадобится legacy UI)

```bash
npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2
export PATH="$HOME/.local/bin:$PATH"
```

Native GIM UI идёт без DSH; DSH только с `GIM_USE_DSH=1`.

### 5.4 Проверка

```bash
node bin/gim.js doctor
node bin/gim.js doctor --policy
```

Field-скрипт (опционально): `bash scripts/field-linux.sh --gguf ~/ai/models/model.gguf`

---

## 6. macOS

Подробнее: **[MACOS.md](./MACOS.md)**.

### 6.1 Установить

1. **Node.js 22+** — https://nodejs.org/ или `brew install node@22`
2. **Docker Desktop for Mac** — для guest (https://www.docker.com/products/docker-desktop/)

### 6.2 Ограничение macOS

**Colibri / vLLM в Docker на Mac не поддерживаются** (нет GPU passthrough как на Win/Linux). Варианты:

- локальный **GGUF** через llama (Metal на Apple Silicon),
- облако: **`gim start --api deepseek`** (и т.п.).

### 6.3 Быстрый путь

```bash
mkdir -p ~/ai/models
git clone https://github.com/eldar-p/gim-cli.git ~/ai/gim
cd ~/ai/gim

node bin/gim.js doctor

# локальная модель (скачайте .gguf на Hugging Face → ~/ai/models/)
node bin/gim.js bootstrap --gguf ~/ai/models/Qwen3-4B-Q4_K_M.gguf
node bin/gim.js start --gguf ~/ai/models/Qwen3-4B-Q4_K_M.gguf

# или облако без GGUF:
# node bin/gim.js bootstrap --api deepseek --api-key sk-...
# node bin/gim.js start --api deepseek

node bin/gim.js status   # скопируйте URL UI
```

Field-скрипт: `bash scripts/field-macos.sh --gguf ~/ai/models/model.gguf`

---

## 7. Три способа подключить «мозг»

Выберите **один** для первого запуска.

### A — Облачный API (без GPU, без скачивания GGUF)

```bash
node bin/gim.js bootstrap --api deepseek --api-model deepseek-chat --api-key sk-ВАШ_КЛЮЧ
node bin/gim.js start --api deepseek
```

Список провайдеров: `node bin/gim.js api`

### B — Локальный GGUF (llama-server)

1. Скачайте файл **`.gguf`** с Hugging Face (кнопка **↓** у файла, не HTML-страницу).
2. Размер обычно **сотни MB – десятки GB**. Файл ~200 KB с `<html>` внутри — ошибка загрузки.

```bash
node bin/gim.js bootstrap --gguf "/path/to/model.Q4_K_M.gguf"
node bin/gim.js start --gguf "/path/to/model.Q4_K_M.gguf"
# слабая GPU / ошибки VRAM:
node bin/gim.js start --gguf "/path/to/model.gguf" --cpu
```

### C — Colibri в Docker (Windows / Linux, большие MoE)

Нужны: Docker, NVIDIA (для GPU), модель safetensors, Linux `coli` в `GIM_COLIBRI_ROOT`.  
Это путь по умолчанию для `gim start` **без** `--gguf`, если Colibri уже настроен.

```bash
# после настройки модели и Colibri — см. docs/ARCHITECTURE.md
node bin/gim.js start
```

Если Colibri ещё не настроен — для первого раза используйте **A** или **B**.

---

## 8. Запуск и остановка

### Bootstrap (один раз на стек)

Привязывает модель или API в `~/.gim/config.json`:

```bash
node bin/gim.js bootstrap --gguf "/path/model.gguf"
# или
node bin/gim.js bootstrap --api deepseek --api-key sk-...
```

### Start

```bash
node bin/gim.js start --gguf "/path/model.gguf"    # явный GGUF
node bin/gim.js start --api deepseek               # облако
node bin/gim.js start                              # Colibri, если уже настроен (Win/Linux)
```

Первый запуск может занять **несколько минут** (Docker-образ guest, загрузка llama/Colibri). Тишина в консоли ≠ зависание — подождите до 5 мин.

### Status и браузер

```bash
node bin/gim.js status
```

Откройте строку **UI:** (`http://127.0.0.1:…/`). Терминал с `start` можно свернуть, но не убивать процесс без `stop`.

### Stop

```bash
node bin/gim.js stop              # UI/guest off; LLM warm (Colibri) по умолчанию
node bin/gim.js stop --full-stop  # полностью снять LLM-контейнер
```

---

## 9. FAQ — только реальные ошибки

### `node` / `npm` не найден

Node не в PATH или терминал открыт до установки. Переустановите Node с **Add to PATH**, закройте все терминалы, проверьте `node --version`.

### Docker: `Cannot connect to the Docker daemon`

Docker Desktop / `dockerd` не запущен. Windows: Пуск → Docker Desktop → **Engine running**. Linux: `sudo systemctl start docker`.

### `Invalid volume format` / guest RED / mount failed

Кириллица или пробелы в пути к проекту/workspace. Перенесите в `C:\ai\gim` или `~/ai/gim`, повторите `bootstrap` + `start`.

### `Port already in use`

Прошлый стек не остановлен:

```bash
node bin/gim.js stop
```

Если не помогло — перезапуск Docker, затем снова `stop` → `start`.

### GGUF: Llama RED / health timeout

- Проверьте, что файл `.gguf` > 500 MB и путь верный.
- Нехватка VRAM → `gim start --gguf "…" --cpu`.
- Лог: `~/.gim/run/default/llama.log` (Windows: `%USERPROFILE%\.gim\run\default\llama.log`).

### Скачали HTML вместо модели

На Hugging Face нажимайте **стрелку скачивания** у строки `.gguf`, не «Save page». Файл должен быть `.gguf`, не `.html`.

### WSL: `dsh` не найден или Windows-shim

Windows `dsh.exe` из `/mnt/c/...` не подходит. Установите Linux-копию:

```bash
npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2
export PATH="$HOME/.local/bin:$PATH"
```

### `Refuse gim start as root`

Запускайте от обычного пользователя; на Linux — `sudo usermod -aG docker $USER`.

### Colibri: model / coli not found

Colibri требует отдельной настройки (модель safetensors, Linux `coli`). Для первого опыта используйте `--gguf` или `--api`.

### «Вчера работало»

1. Docker запущен?  
2. Вы в папке проекта?  
3. `node bin/gim.js doctor`  
4. `node bin/gim.js stop` → `start` с теми же флагами (`--gguf` / `--api`).

---

## 10. Шпаргалка

**Windows**

```powershell
cd C:\ai\gim
node bin/gim.js doctor
node bin/gim.js bootstrap --gguf "C:\ai\models\MODEL.gguf"
node bin/gim.js start --gguf "C:\ai\models\MODEL.gguf"
node bin/gim.js status
node bin/gim.js stop
```

**Linux**

```bash
cd ~/ai/gim
node bin/gim.js doctor
node bin/gim.js bootstrap --gguf ~/ai/models/MODEL.gguf
node bin/gim.js start --gguf ~/ai/models/MODEL.gguf
node bin/gim.js status
node bin/gim.js stop
```

**macOS** — как Linux, но без Colibri; на Apple Silicon Metal часто без `--cpu`.

**Облако (все ОС)**

```bash
node bin/gim.js bootstrap --api deepseek --api-key sk-...
node bin/gim.js start --api deepseek
node bin/gim.js status
```

---

## Дальше

- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- [docs/OS-COMPAT.md](./docs/OS-COMPAT.md)
- [docs/LINUX.md](./docs/LINUX.md) · [MACOS.md](./MACOS.md)
- [docs/SECURITY.md](./docs/SECURITY.md) — что продукт реально защищает

**Лицензия:** [Apache-2.0](./LICENSE)
