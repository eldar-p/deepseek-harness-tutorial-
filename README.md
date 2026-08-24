# Deep CLI

Локальный стек: **llama.cpp** + **Docker guest** + **DSH**.  
**Стадия:** [Alpha `v0.2.0-alpha`](./ALPHA.md) · complete · revision `2026.08.24-alpha`

[Документация](./docs/README.md) · [Установка](./docs/INSTALL.md) · [Troubleshooting](./docs/TROUBLESHOOTING.md) · [ADR](./adr/README.md) · [Alpha todo](./todo/README.md) · [Beta todo](./todo/README-beta.md) · [Changelog](./CHANGELOG.md)

## Требования

- Node.js **^22.19** или **≥24**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (или Podman) — Engine running
- GGUF-модель (например Q4_K_M)
- Опционально: `npm i -g @deepseek-ai/dsh@0.1.1-rc.2`

## Быстрый старт

```bash
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
git checkout v0.2.0-alpha   # или main
```

**Windows:**

```powershell
powershell -File .\scripts\wait-docker.ps1
node bin/deep.js bootstrap --gguf "PATH\to\model.Q4_K_M.gguf"
node bin/deep.js start --cpu
node bin/deep.js status
```

**macOS / Linux:**

```bash
node bin/deep.js bootstrap --gguf /path/to/model.Q4_K_M.gguf
node bin/deep.js start --cpu
node bin/deep.js status
```

Открой URL **DSH** из вывода `status` (порт случайный, ~13000–14000).

```powershell
node bin/deep.js stop
```

## Команды

| Команда | Описание |
|---------|----------|
| `deep doctor [--readiness] [--stage alpha]` | Проверка окружения / readiness |
| `deep bootstrap --gguf PATH` | Конфиг, assets, prefetch llama |
| `deep start [--name STACK] [--cpu] [--preset NAME]` | Поднять стек |
| `deep stop [--name STACK]` | Остановить |
| `deep status [--name STACK] [--all]` | Статус |
| `deep stacks` | Список стеков |
| `deep presets` | Пресеты сети / traces |
| `deep update` | Сверка канала (git) |

Алиас после `npm link`: `deep` → `bin/deep.js`.

## Архитектура

```text
User → deep CLI (host)
         ├── llama-server   127.0.0.1:PORT/v1
         ├── deep-guest     Docker + iptables allowlist @ /workspace
         └── DSH web        127.0.0.1:PORT/  → llama + guest tools
```

Образ: `deep-guest:0.2-beta` (entrypoint `deep-net-enforce`).  
Подробнее: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## Quality / smoke

```bash
npm test
npm run test:coverage    # ≥50% src (beta gate)
npm run audit:alpha
npm run smoke:guest      # Docker image + mount
npm run smoke:e2e        # живой стек: jail, HTTP, chat, guest
```

## Структура репо (Deep)

```text
bin/deep.js          CLI entry
src/                 оркестратор
manifests/           pins (llama, guest, channels)
assets/              cordis patch, AGENTS, memory template
dsh-plugins/         guest-bash-local, workspace-jail-fs, …
presets/             balanced, offline, paranoia, …
Dockerfile.guest     образ deep-guest:prealpha
todo/                alpha + beta backlog
adr/                 architecture decisions
docs/                install, audits, legal
```

## Legacy tutorial (VirtualBox)

Старый трек с Debian VM + LM Studio остаётся в репо, но **не** является продуктом Deep CLI.

| ОС | Установка | Хост-скрипты |
|----|-----------|--------------|
| Windows | `install.ps1` + `env.example` | `host/` |
| macOS | `install.sh` + `env.sh.example` | `host-mac/` · [MACOS.md](./MACOS.md) |

Там же: Shared Folder → `/mnt/hostshare`, SSH `:2222`, Tor `:9050`, DSH на `:3080`, модель через LM Studio `:1234`.

---

**Лицензия:** [MIT](./LICENSE) · **Тег:** [`v0.2.0-alpha`](https://github.com/eldar-p/deepseek-harness-tutorial-/releases/tag/v0.2.0-alpha)
