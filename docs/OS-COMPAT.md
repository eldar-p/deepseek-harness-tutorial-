# OS compatibility matrix

Last verified: **2026-08-24**  
CI: unit matrix (win/mac/linux) + **field-lite** (ubuntu + macos llama CPU fetch) + guest smoke (ubuntu).

Deep is a **hybrid** host orchestrator: local GGUF (`llama-server`) **or** cloud API (`--api`). Guest container (Docker/Podman), code index, and egress proxy are shared.

## CI / automated

| Check | Ubuntu | macOS | Windows |
|-------|--------|-------|---------|
| Unit tests (`npm test`) | PASS | PASS | PASS |
| Coverage gate (≥80%, floor 78) | PASS | PASS | PASS |
| Audit pre-alpha | PASS | PASS | PASS |
| Infra check | PASS | PASS | PASS |
| `deep doctor` / `help` | PASS | PASS | PASS |
| Harness pack + API smoke | PASS | PASS | PASS |
| **Field-lite** (policy + llama fetch) | PASS (job) | PASS (job) | via local `deep field lite` |
| Guest smoke (build + mount) | PASS | n/a | n/a |

## Local / field (full stack)

| Capability | Windows | Linux (native / WSL) | macOS |
|------------|---------|----------------------|-------|
| `deep doctor --policy` | PASS | PASS | field-lite CI |
| `deep field lite` | PASS | PASS | CI job |
| Guest smoke | PASS | PASS (Desktop integration / image load) | Docker Desktop |
| `deep start` local GGUF | PASS | PASS (CPU / Vulkan) | Metal pin; needs Mac + GGUF |
| `smoke-e2e` | PASS | PASS (WSL field) | run `field-macos.sh --gguf …` |
| `deep start --api …` | wired | wired | wired |

## Field helpers

```bash
# Offline + llama CPU auto-fetch (CI runs this on ubuntu/macos)
deep field lite
npm run field:lite

# Full stack (needs Docker + GGUF)
bash scripts/field-linux.sh --gguf /path/model.gguf
bash scripts/field-macos.sh --gguf /path/model.gguf
bash scripts/field-linux-wsl.sh --gguf /path/model.gguf

# Readiness checklist for OS parity assets
deep doctor --readiness --stage=field
```

## Known gaps / notes

1. **llama pins** — win32 / linux (cpu+vulkan) / darwin sha256 for **b9771**.
2. **WSL Docker** — prefer Docker Desktop WSL integration; apt docker is often a separate daemon.
3. **WSL DSH** — install Linux dsh under `~/.local` (reject `/mnt/c` Windows shim).
4. **macOS physical full stack** — no dedicated Mac in lab; Metal binary + field-lite CI green; full e2e needs operator with GGUF.
5. **Linux CUDA** — no official ggml zip; use Vulkan pin or `DEEP_LLAMA_BIN`.

## Recommended models (quick)

| Mode | Recommendation |
|------|----------------|
| Local coding (16GB VRAM) | Qwen3-Coder-30B Q3_K_M |
| Local spare / smaller | gpt-oss-20b Q8 or Qwen3-4B Q4 |
| Cloud | `--api deepseek` / `openai` / `openrouter` |

See [README.md](../README.md) · [HARNESS-TEST-PACK.md](./HARNESS-TEST-PACK.md) · [INSTALL.md](./INSTALL.md).
