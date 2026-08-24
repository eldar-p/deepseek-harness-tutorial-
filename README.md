# GIM CLI

**Гибридный AI-оркестратор:** Colibri Docker (default Win/Linux) **или** GGUF / cloud API + Docker guest + **native GIM UI**.  
Работает **на вашей машине** (agent, sandbox, index, security eval).

**Стадия:** [Alpha](./ALPHA.md) · tag [`v0.2.0-alpha`](https://github.com/eldar-p/gim-cli/releases/tag/v0.2.0-alpha)  
**Лицензия:** [Apache-2.0](./LICENSE)

[Документация](./docs/README.md) · **[Гайд для новичков](./README_BEGINNER.md)** · [Linux](./docs/LINUX.md) · [macOS](./MACOS.md) · [Security](./docs/SECURITY.md) · [Speed P0–P6](./docs/SPEED.md)

> **Впервые?** → [README_BEGINNER.md](./README_BEGINNER.md)

---

## Режимы модели

| Режим | Флаг | Когда использовать |
|-------|------|-------------------|
| **Colibri Docker** | `gim start` (Win/Linux) | Большие MoE локально, warm LLM, KV slots |
| **Локальный GGUF** | `--gguf PATH` | macOS, офлайн, llama Metal/CUDA/Vulkan |
| **Облачный API** | `--api PROVIDER` | Нет GPU, быстрый старт |
| **Гибрид стеков** | `--name work` / `--name local` | Один стек на API, другой на Colibri/GGUF |

Провайдеры API: `openai`, `deepseek`, `openrouter`, `groq`, `together`, `custom` — см. `gim api`.

---

## Рекомендуемые модели

### Локальные GGUF (field-tested, RTX 4070 Ti 16 GB)

| Модель | Квант | VRAM | Coding / tools | Вердикт |
|--------|-------|------|----------------|---------|
| **Qwen3-Coder-30B A3B Instruct** | Q3_K_M (~14 GB) | ~16 GB | **16/16** eval | **Лучший coding agent** |
| gpt-oss-20b | Q8_0 (~11 GB) | ~12 GB | 14/16 | Сильный запасной |
| Qwen3-4B | Q4_K_M (~2.3 GB) | ~4 GB | 12/16 | Smoke / слабый ПК |
| gemma-3-1b | Q6 (~1 GB) | минимум | слабый | Только проверка стека |

Предпочитайте **Q4_K_M+** для tool-heavy задач; Q3 — с предупреждением `gim start`.

### Облачные API (через `--api`)

| Провайдер | Модель (пример) | Зачем |
|-----------|-----------------|-------|
| **deepseek** | `deepseek-chat`, `deepseek-reasoner` | Дёшево, сильный код, OpenAI-compatible |
| **openai** | `gpt-4o`, `gpt-4o-mini` | Универсальный SOTA |
| **openrouter** | `deepseek/deepseek-chat`, Claude, Llama | Один ключ — много моделей |
| **groq** | `llama-3.3-70b-versatile` | Быстрый inference |
| **together** | `Qwen2.5-Coder-32B-Instruct-Turbo` | Облачный кодер без своей GPU |
| **custom** | любая | Свой LiteLLM / vLLM / корпоративный endpoint |

---

## Требования

- Node.js **^22.19** или **≥24**
- **Docker Desktop** (guest sandbox) — Engine running
- **Модель:** GGUF **или** API-ключ облака
- DSH: `npm i -g @deepseek-ai/dsh@0.1.1-rc.2`

---

## Быстрый старт — локальный GGUF

```powershell
git clone https://github.com/eldar-p/gim-cli.git
cd gim-cli
powershell -File .\scripts\wait-docker.ps1
npm install -g @deepseek-ai/dsh@0.1.1-rc.2
node bin/gim.js bootstrap --gguf "C:\ai\models\Qwen3-4B-Q4_K_M.gguf"
node bin/gim.js start
node bin/gim.js status
```

## Быстрый старт — облачный API (без GPU и без GGUF)

```powershell
node bin/gim.js bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...
node bin/gim.js start --api deepseek
node bin/gim.js status
```

Или ключ через env: `$env:DEEPSEEK_API_KEY="sk-..."` → `gim start --api deepseek`

Свой endpoint:

```powershell
node bin/gim.js bootstrap --api custom --api-base https://llm.example.com/v1 --api-model my-model --api-key ...
```

---

## Команды

| Команда | Описание |
|---------|----------|
| `gim doctor` | Проверка окружения (+ `--policy`) |
| `gim test harness` | Offline guardrail pack |
| `gim field lite` | OS field-lite (llama fetch) |
| `gim bootstrap --gguf PATH` | Локальная модель |
| `gim bootstrap --api PROVIDER [--api-model M] [--api-key K]` | Облачная модель |
| `gim start [--gguf PATH \| --api PROVIDER] [--cpu]` | Поднять стек |
| `gim stop` | Остановить (не спамить Ctrl+C) |
| `gim status` | DSH URL + модель |
| `gim index build \| search \| status` | Семантический поиск по коду |
| `gim lsp servers \| query …` | Host LSP (definition/hover/…) |
| `gim daemon start \| stop \| status \| tick` | Health poller (llama/DSH) |
| `gim mcp` | Stdio MCP (tool_search, code_search, …) |
| `gim mcp config` | JSON для Cursor MCP |
| `gim coord --task=…` | Параллельный index-search |
| `gim risk classify "cmd" [--llm]` | Auto-mode risk label |
| `gim risk write-path PATH` | Deny secrets/VCS paths |
| `gim api` | Список API-провайдеров |

---

## Архитектура

```text
User → GIM CLI (host)
         ├── Model backend
         │     ├── llama-server  127.0.0.1:PORT/v1  (local --gguf)
         │     └── cloud API     OpenAI-compatible (--api)
         ├── gim-guest          Docker sandbox @ /workspace
         ├── egress-proxy        allowlist + secrets on host
         ├── code-index          semantic search (LanceDB optional)
         └── DSH web             127.0.0.1:PORT/
```

Guest + jail + index работают **одинаково** в local и API режиме — меняется только «мозг».

Подробнее: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/CLAUDE-CODE-LEAK-TRIAGE.md](./docs/CLAUDE-CODE-LEAK-TRIAGE.md)

---

## Quality / smoke

```bash
npm test
npm run audit:security
npm run test:security
npm run smoke:e2e
```

---

**Лицензия:** [Apache-2.0](./LICENSE)
