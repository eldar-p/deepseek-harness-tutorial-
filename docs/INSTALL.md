# Install Deep CLI

Deep is a **hybrid** orchestrator: model backend can be **local GGUF** (`llama-server`) **or** **cloud API** (`--api`). Guest container, code index, and egress proxy are the same in both modes.

See also: [OS-COMPAT.md](./OS-COMPAT.md) · [README_BEGINNER.md](../README_BEGINNER.md)

## Requirements

- **Node.js** ≥ 22 (22.19+ recommended per `package.json` engines)
- **Docker Desktop / Podman** (required for guest; start engine before `deep start`)
- **Model backend** — one of:
  - Local **GGUF** file (`--gguf`), or
  - Cloud provider (`--api deepseek|openai|openrouter|…` + API key)
- **DSH** (recommended for chat UI): `npm i -g @deepseek-ai/dsh@0.1.1-rc.2`

## From git (pre-alpha)

```bash
git clone https://github.com/eldar-p/deepseek-harness-tutorial-.git
cd deepseek-harness-tutorial-
npm link
# or
./scripts/install-deep.sh --channel=stable
```

Windows:

```powershell
# Install and start Docker Desktop first (wait for "Engine running")
powershell -File .\scripts\wait-docker.ps1

powershell -File .\scripts\install-deep.ps1 -Channel stable
# Add %LOCALAPPDATA%\deep\bin to PATH
```

Docker CLI is often at `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`. Deep resolves this path automatically; override with `DEEP_DOCKER_BIN` if needed.

## First run — local GGUF

```bash
deep doctor
deep bootstrap --gguf /path/to/model.Q4_K_M.gguf --preset balanced
deep start
deep status
deep stop
```

## First run — cloud API (no GPU / no GGUF)

```bash
deep api   # list providers
deep bootstrap --api deepseek --api-model deepseek-chat --api-key sk-...
deep start --api deepseek
deep status   # shows API row instead of Llama
```

Env keys also work (`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, …). Do not pass `--gguf` and `--api` together.

## Linux / WSL notes

1. **Do not run `deep start` as root** — Deep refuses root.
2. **DSH on WSL** — Windows npm shim under `/mnt/c/...` is ignored. Install a Linux copy:

   ```bash
   npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2
   export PATH="$HOME/.local/bin:$PATH"
   # or: export DEEP_DSH_BIN="$HOME/.local/bin/dsh"
   ```

3. **Docker** — prefer **Docker Desktop → WSL integration** so Windows and WSL share one engine. Apt `docker` is often a **separate** daemon (no shared images). Workarounds:
   - enable Desktop integration for your distro, or
   - `docker save deep-guest:0.2-beta -o guest.tar` on Windows → `docker load -i guest.tar` in WSL, or
   - install `docker-buildx-plugin` and rebuild (`DOCKER_BUILDKIT=1`).
4. **llama.cpp** — linux/darwin/win CPU (and win CUDA) binaries are auto-fetched with pinned sha256 (`manifests/llama-binaries.json`). Shared libs need the binary dir on `LD_LIBRARY_PATH` (Deep sets this on start).
5. Field helper: `bash scripts/field-linux-wsl.sh` (from a non-root WSL user).

## Channels

`stable` (default), `beta`, `edge` — see [dist/CHANNELS.md](./dist/CHANNELS.md).

```bash
deep bootstrap --channel beta
deep update --channel stable
```

## Layout after bootstrap

```text
~/.deep/
  config.json
  models/
  runtime/llama/
  dsh-home/
  workspace/<stack>/
  manifests-cache/
  secrets.json          # host-only API keys for egress proxy (never in guest)
  logs/deep.log
```

## Uninstall

Remove `~/.deep` if desired, delete npm link / `deep.cmd`, optional: Docker image `deep-guest:0.2-beta` / `deep-guest:prealpha`.
