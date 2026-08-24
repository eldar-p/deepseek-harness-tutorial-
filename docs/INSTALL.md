# Install GIM CLI

GIM is a **hybrid** orchestrator: model backend can be **local GGUF** (`llama-server`) **or** **cloud API** (`--api`). Guest container, code index, and egress proxy are the same in both modes.

See also: [OS-COMPAT.md](./OS-COMPAT.md) · [LINUX.md](./LINUX.md) · [../MACOS.md](../MACOS.md) · [README_BEGINNER.md](../README_BEGINNER.md)

## Requirements

- **Node.js** ≥ 22 (22.19+ recommended per `package.json` engines)
- **Docker Desktop / Podman** (required for guest; start engine before `gim start`)
- **Model backend** — one of:
  - Local **GGUF** file (`--gguf`), or
  - Cloud provider (`--api deepseek|openai|openrouter|…` + API key)
- **DSH** (recommended for chat UI): `npm i -g @deepseek-ai/dsh@0.1.1-rc.2`

## From git (pre-alpha)

```bash
git clone https://github.com/eldar-p/gim-cli.git
cd gim-cli
npm link
# or
./scripts/install-gim.sh --channel=stable
```

Windows:

```powershell
# Install and start Docker Desktop first (wait for "Engine running")
powershell -File .\scripts\wait-docker.ps1

powershell -File .\scripts\install-gim.ps1 -Channel stable
# Add %LOCALAPPDATA%\gim\bin to PATH
```

Docker CLI is often at `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`. GIM resolves this path automatically; override with `GIM_DOCKER_BIN` if needed.

## First run — local GGUF

```bash
gim doctor
gim bootstrap --gguf /path/to/model.Q4_K_M.gguf --preset balanced
gim start
gim status
gim stop
```

## First run — cloud API (no GPU / no GGUF)

```bash
deep api   # list providers
gim bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...
gim start --api deepseek
gim status   # shows API row instead of Llama
```

Env keys also work (`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, …). Do not pass `--gguf` and `--api` together.

## Linux / WSL notes

1. **Do not run `gim start` as root** — GIM refuses root.
2. **DSH on WSL** — Windows npm shim under `/mnt/c/...` is ignored. Install a Linux copy:

   ```bash
   npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2
   export PATH="$HOME/.local/bin:$PATH"
   # or: export GIM_DSH_BIN="$HOME/.local/bin/dsh"
   ```

3. **Docker** — prefer **Docker Desktop → WSL integration** so Windows and WSL share one engine. Apt `docker` is often a **separate** daemon (no shared images). Workarounds:
   - enable Desktop integration for your distro, or
   - `docker save gim-guest:0.2-beta -o guest.tar` on Windows → `docker load -i guest.tar` in WSL, or
   - install `docker-buildx-plugin` and rebuild (`DOCKER_BUILDKIT=1`).
4. **llama.cpp** — linux/darwin/win CPU (win CUDA, linux **Vulkan**, darwin Metal) binaries are auto-fetched with pinned sha256 (`manifests/llama-binaries.json`). Official ggml has **no Linux CUDA** zip — use Vulkan or set `GIM_LLAMA_BIN` to a self-built CUDA `llama-server`. Shared libs need the binary dir on `LD_LIBRARY_PATH` (GIM sets this on start).
5. Field helper: `bash scripts/field-linux-wsl.sh` (from a non-root WSL user).

## Channels

`stable` (default), `beta`, `edge` — see [dist/CHANNELS.md](./dist/CHANNELS.md).

```bash
gim bootstrap --channel beta
gim update --channel stable
```

## Layout after bootstrap

```text
~/.gim/
  config.json
  models/
  runtime/llama/
  dsh-home/
  workspace/<stack>/
  manifests-cache/
  secrets.json          # host-only API keys for egress proxy (never in guest)
  logs/gim.log
```

## Uninstall

Remove `~/.gim` if desired, delete npm link / `gim.cmd`, optional: Docker image `gim-guest:0.2-beta` / `gim-guest:prealpha`.
