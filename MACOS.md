# GIM CLI на macOS

Актуальный продукт — **GIM CLI** (`bin/gim.js`): guest в Docker + native UI + LLM через **GGUF (Metal)** или **облачный API**.

Windows: [README_BEGINNER.md](./README_BEGINNER.md) · Linux: [docs/LINUX.md](./docs/LINUX.md)

---

## Что работает на Mac

| Компонент | Статус |
|-----------|--------|
| `gim doctor`, harness, security eval | ✅ CI `macos-latest` |
| Docker guest (`gim-guest-*`) | ✅ Docker Desktop |
| Native GIM UI | ✅ при `gim start` |
| Локальный GGUF (llama, Metal) | ✅ Apple Silicon / Intel |
| Облачный `--api` | ✅ |
| **Colibri / vLLM в Docker** | ❌ не поддерживается |
| NVIDIA CUDA llama zip | ❌ используйте Metal (darwin) или API |

**Почему нет Colibri на Mac:** LLM Docker рассчитан на Win/Linux с NVIDIA; на macOS нет того же GPU passthrough в Docker. Обход — GGUF на Metal или cloud API (универсальный путь продукта, без отдельного «mac-only» бэкенда в core).

---

## Требования

- **macOS** 12+ (Ventura+ рекомендуется для Docker Desktop)
- **Node.js** ^22.19 или ≥24 — https://nodejs.org/ или `brew install node@22`
- **Docker Desktop for Mac** — https://www.docker.com/products/docker-desktop/
- **Модель:** файл `.gguf` **или** API-ключ

Опционально **Homebrew** для зависимостей:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22 git
```

---

## Установка GIM

```bash
mkdir -p ~/ai/models
git clone https://github.com/eldar-p/gim-cli.git ~/ai/gim
cd ~/ai/gim
node bin/gim.js doctor
```

Пути **без пробелов** предпочтительны (`~/ai/gim`, не `~/Desktop/My AI`).

---

## Вариант 1 — локальный GGUF (Metal)

### Скачать модель

1. Hugging Face → вкладка **Files** → файл `*.gguf` (для начала Qwen3-4B **Q4_K_M**, ~2–3 GB).
2. Сохранить в `~/ai/models/`.

Проверка: `file ~/ai/models/*.gguf` — не HTML.

### Bootstrap + start

```bash
node bin/gim.js bootstrap --gguf ~/ai/models/Qwen3-4B-Q4_K_M.gguf
node bin/gim.js start --gguf ~/ai/models/Qwen3-4B-Q4_K_M.gguf
node bin/gim.js status
```

На **Apple Silicon** Metal обычно включается автоматически. На Intel без GPU:

```bash
node bin/gim.js start --gguf ~/ai/models/MODEL.gguf --cpu
```

Откройте **UI:** из вывода `status`.

---

## Вариант 2 — облачный API (без GGUF)

```bash
node bin/gim.js bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...
node bin/gim.js start --api deepseek
node bin/gim.js status
```

Провайдеры: `node bin/gim.js api`

---

## Field-скрипт (проверка стека)

```bash
bash scripts/field-macos.sh --gguf ~/ai/models/MODEL.gguf
```

Без `--gguf` — только `doctor` + `field-lite` (offline checks).

**Не работает на Mac:**

```bash
bash scripts/field-macos.sh --colibri   # exit 2 — use --gguf or --api
```

---

## Остановка

```bash
node bin/gim.js stop
node bin/gim.js stop --full-stop   # если поднимали LLM через другие эксперименты
```

---

## Типичные проблемы (macOS)

| Симптом | Причина | Действие |
|---------|---------|----------|
| Docker daemon not running | Docker Desktop закрыт | Запустить Docker, дождаться Ready |
| Guest RED | путь с пробелами / Docker не готов | `~/ai/gim`, `gim doctor`, перезапуск Docker |
| Llama timeout | модель слишком большая для RAM | меньшая модель или `--cpu` |
| `arm64` vs `x64` binary | неверный llama pin | `gim doctor`; переустановка через bootstrap |
| `--colibri` / `--vllm` ошибка | LLM Docker только Win/Linux | `--gguf` или `--api` |
| Port in use | не было `gim stop` | `gim stop`, при необходимости quit Docker |

Логи: `~/.gim/run/default/llama.log`, `~/.gim/logs/gim.log`

---

## DSH (legacy UI, опционально)

По умолчанию GIM поднимает **native UI**. Старый DSH:

```bash
npm i -g @deepseek-ai/dsh@0.1.1-rc.2
GIM_USE_DSH=1 node bin/gim.js start --gguf ~/ai/models/MODEL.gguf
```

---

## Чеклист macOS

- [ ] `node --version` ≥ 22.19  
- [ ] Docker Desktop running  
- [ ] `node bin/gim.js doctor` — engine OK  
- [ ] GGUF в `~/ai/models/` **или** API key в bootstrap  
- [ ] `gim start --gguf …` **или** `gim start --api …`  
- [ ] UI открывается из `gim status`  
- [ ] `gim stop` после работы  

---

## Без физического Mac

CI: GitHub Actions `macos-latest` + `field-lite`. Локальный full e2e на Mac без железа — см. [docs/MACOS-WITHOUT-HARDWARE.md](./docs/MACOS-WITHOUT-HARDWARE.md).

---

См. также: [README_BEGINNER.md](./README_BEGINNER.md) · [docs/OS-COMPAT.md](./docs/OS-COMPAT.md) · [docs/INSTALL.md](./docs/INSTALL.md)
