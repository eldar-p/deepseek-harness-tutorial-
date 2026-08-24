# OS compatibility matrix

Last verified: **2026-08-24** (CI run [`32707180955`](https://github.com/eldar-p/deepseek-harness-tutorial-/actions/runs/32707180955) + local Windows field).

Deep is a **hybrid** host orchestrator: local GGUF (`llama-server`) **or** cloud API (`--api`). Guest container (Docker/Podman), code index, and egress proxy are shared.

## CI / automated

| Check | Ubuntu | macOS | Windows |
|-------|--------|-------|---------|
| Unit tests (`npm test`) | PASS | PASS | PASS |
| Coverage gate (≥65%) | PASS | PASS | PASS |
| Audit pre-alpha | PASS | PASS | PASS |
| Infra check | PASS | PASS | PASS |
| `deep doctor` / `help` | PASS | PASS | PASS |
| Guest smoke (build + mount) | PASS | n/a (job only on Ubuntu) | n/a |

## Local / field (full stack)

| Capability | Windows (this machine) | Linux (WSL Ubuntu) | macOS |
|------------|------------------------|--------------------|-------|
| `deep doctor` | PASS (Docker Desktop) | PASS (engine OK) | not field-tested here |
| Unit tests + security audit | PASS | PASS (167/170*; audits OK) | via CI only |
| Guest smoke | PASS when Docker ready | FAIL without buildx / legacy builder | — |
| `deep start` local GGUF | PASS (llama+DSH+index+proxy) | BLOCKED: linux llama zip has no pinned `sha256` in `manifests/llama-binaries.json` | — |
| Guest on start | PASS when Docker engine up; FAIL if Desktop still waking | — | — |
| Agent task (`model-coding-eval`) | PASS 12/16 on Qwen3-Coder-30B Q3 | not run (no start) | — |
| `deep start --api …` | wired in CLI; needs API key | same | same |

\*WSL failures were zip/`unzip` + jail host-path cases on older tree; jail fixed in `5b8800a` / `685f975`. Re-run WSL tests after pull to confirm 170/170.

## Known gaps

1. **Linux/macOS llama auto-fetch** — entries in `llama-binaries.json` need pinned `sha256` (or manual `DEEP_LLAMA_BIN` / place binaries under `~/.deep/runtime/llama/`).
2. **WSL Docker build** — guest image build may need BuildKit/`docker-buildx`.
3. **Coverage** — measured ~69–73% vs historical 80% gate; CI uses `DEEP_COVERAGE_MIN=65` until more src tests land.
4. **macOS field stack** — no physical Mac in this session; rely on CI unit matrix.

## Recommended models (quick)

| Mode | Recommendation |
|------|----------------|
| Local coding (16GB VRAM) | Qwen3-Coder-30B Q3_K_M |
| Local spare / smaller | gpt-oss-20b Q8 or Qwen3-4B Q4 |
| Cloud | `--api deepseek` / `openai` / `openrouter` |

See [README.md](../README.md) for full tables and flags.
