# Install Deep CLI

## Requirements

- **Node.js** ≥ 22 (22.19+ recommended per `package.json` engines)
- **GGUF** model file (or path via `--gguf`)
- **Docker Desktop / Podman** (required for guest container; start Docker Desktop before `deep start`)
- **DSH** (optional): `npm i -g @deepseek-ai/dsh@0.1.1-rc.2`

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

Docker CLI is often at `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`. Deep CLI resolves this path automatically; override with `DEEP_DOCKER_BIN` if needed.

## First run

```bash
deep doctor
deep bootstrap --gguf /path/to/model.Q4_K_M.gguf --preset balanced
deep start
deep status
deep stop
```

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
  logs/deep.log
```

## Uninstall

Remove `~/.deep` if desired, delete npm link / `deep.cmd`, optional: Docker image `deep-guest:prealpha`.
