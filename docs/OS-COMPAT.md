# OS compatibility matrix

Last verified: **2026-08-24**  
CI: [`32708202606`](https://github.com/eldar-p/deepseek-harness-tutorial-/actions/runs/32708202606) (unit matrix) + Linux field WSL after llama sha pins.

Deep is a **hybrid** host orchestrator: local GGUF (`llama-server`) **or** cloud API (`--api`). Guest container (Docker/Podman), code index, and egress proxy are shared.

## CI / automated

| Check | Ubuntu | macOS | Windows |
|-------|--------|-------|---------|
| Unit tests (`npm test`) | PASS | PASS | PASS |
| Coverage gate (≥65%) | PASS | PASS | PASS |
| Audit pre-alpha | PASS | PASS | PASS |
| Infra check | PASS | PASS | PASS |
| `deep doctor` / `help` | PASS | PASS | PASS |
| Guest smoke (build + mount) | PASS | n/a (Ubuntu-only job) | n/a |

## Local / field (full stack)

| Capability | Windows (this machine) | Linux (WSL Ubuntu 24.04) | macOS |
|------------|------------------------|--------------------------|-------|
| `deep doctor` | PASS (Docker Desktop) | PASS | via CI only |
| Unit tests + security audit | PASS 170/170 | PASS (audits OK) | via CI |
| Guest smoke | PASS | PASS after image load / BuildKit | — |
| `deep start` local GGUF | PASS (llama+DSH+index+proxy+guest) | PASS (CPU; llama auto-fetch + `LD_LIBRARY_PATH`) | — |
| `smoke-e2e` | PASS | **PASS** | — |
| Agent probe / coding eval | **14/16** coding-eval | probe **3/4** (1 model fluke on bash wording) | — |
| `deep start --api …` | wired; needs API key | same | same |

## Known gaps / notes

1. **llama pins** — `manifests/llama-binaries.json` now has sha256 for **win32 / linux / darwin** (b9771).
2. **WSL Docker** — apt `docker` is often a **separate daemon** from Docker Desktop. Prefer Desktop WSL integration, or `docker save`/`load` the guest image; install `docker-buildx-plugin` for local builds.
3. **WSL DSH** — Windows npm shim under `/mnt/c/...` is rejected; install Linux dsh:  
   `npm i -g --prefix ~/.local @deepseek-ai/dsh@0.1.1-rc.2` and put `~/.local/bin` on `PATH` (or `DEEP_DSH_BIN`).
4. **Coverage** — CI uses `DEEP_COVERAGE_MIN=65` (~70% measured).
5. **macOS field stack** — no physical Mac; unit CI green; Metal binary sha pinned for auto-fetch.

## Recommended models (quick)

| Mode | Recommendation |
|------|----------------|
| Local coding (16GB VRAM) | Qwen3-Coder-30B Q3_K_M |
| Local spare / smaller | gpt-oss-20b Q8 or Qwen3-4B Q4 |
| Cloud | `--api deepseek` / `openai` / `openrouter` |

See [README.md](../README.md) for full tables and flags. Field helper: `scripts/field-linux-wsl.sh`.
