# Deep CLI

**Гибридный AI-оркестратор:** локальные GGUF (llama.cpp) **или** облачные OpenAI-compatible API + Docker guest + DSH.  
Работает **на вашей машине** (agent, sandbox, index) — модель может быть **локальной или в облаке**.

**Стадия:** [Alpha](./ALPHA.md) + [Beta](./BETA.md) · tag [`v0.2.0-alpha`](https://github.com/eldar-p/deepseek-harness-tutorial-/releases/tag/v0.2.0-alpha)  
**Лицензия:** [CC BY-NC-SA 4.0](./LICENSE)

[Документация](./docs/README.md) · **[Гайд для новичков](./README_BEGINNER.md)** · [Установка](./docs/INSTALL.md) · [ОС-матрица](./docs/OS-COMPAT.md) · [Troubleshooting](./docs/TROUBLESHOOTING.md) · [ADR](./adr/README.md)

> **Впервые?** → [README_BEGINNER.md](./README_BEGINNER.md)

---

## Режимы модели

| Режим | Флаг | Когда использовать |
|-------|------|-------------------|
| **Локальный GGUF** | `--gguf PATH` | Приватность, офлайн, своя GPU (4070+), нет подписки на API |
| **Облачный API** | `--api PROVIDER` | Нет GPU / слабый ПК, нужен SOTA-кодер, быстрый старт |
| **Гибрид стеков** | `--name work` / `--name local` | Один стек на API, другой на GGUF |

Провайдеры API: `openai`, `deepseek`, `openrouter`, `groq`, `together`, `custom` — см. `deep api`.

---

## Рекомендуемые модели

### Локальные GGUF (field-tested, RTX 4070 Ti 16 GB)

| Модель | Квант | VRAM | Coding / tools | Вердикт |
|--------|-------|------|----------------|---------|
| **Qwen3-Coder-30B A3B Instruct** | Q3_K_M (~14 GB) | ~16 GB | **16/16** eval | **Лучший coding agent** |
| gpt-oss-20b | Q8_0 (~11 GB) | ~12 GB | 14/16 | Сильный запасной |
| Qwen3-4B | Q4_K_M (~2.3 GB) | ~4 GB | 12/16 | Smoke / слабый ПК |
| gemma-3-1b | Q6 (~1 GB) | минимум | слабый | Только проверка стека |

Предпочитайте **Q4_K_M+** для tool-heavy задач; Q3 — с предупреждением `deep start`.

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
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
powershell -File .\scripts\wait-docker.ps1
npm install -g @deepseek-ai/dsh@0.1.1-rc.2
node bin/deep.js bootstrap --gguf "C:\ai\models\Qwen3-4B-Q4_K_M.gguf"
node bin/deep.js start
node bin/deep.js status
```

## Быстрый старт — облачный API (без GPU и без GGUF)

```powershell
node bin/deep.js bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...
node bin/deep.js start --api deepseek
node bin/deep.js status
```

Или ключ через env: `$env:DEEPSEEK_API_KEY="sk-..."` → `deep start --api deepseek`

Свой endpoint:

```powershell
node bin/deep.js bootstrap --api custom --api-base https://llm.example.com/v1 --api-model my-model --api-key ...
```

---

## Команды

| Команда | Описание |
|---------|----------|
| `deep doctor` | Проверка окружения |
| `deep bootstrap --gguf PATH` | Локальная модель |
| `deep bootstrap --api PROVIDER [--api-model M] [--api-key K]` | Облачная модель |
| `deep start [--gguf PATH \| --api PROVIDER] [--cpu]` | Поднять стек |
| `deep stop` | Остановить (не спамить Ctrl+C) |
| `deep status` | DSH URL + модель |
| `deep index build \| search \| status` | Семантический поиск по коду |
| `deep api` | Список API-провайдеров |

---

## Архитектура

```text
User → deep CLI (host)
         ├── Model backend
         │     ├── llama-server  127.0.0.1:PORT/v1  (local --gguf)
         │     └── cloud API     OpenAI-compatible (--api)
         ├── deep-guest          Docker sandbox @ /workspace
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
npm run smoke:e2e
```

---

**Лицензия:** [CC BY-NC-SA 4.0](./LICENSE)
