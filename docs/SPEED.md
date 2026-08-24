# GIM speed bar

Universal targets (any MoE safetensors via Colibri Docker). Not tied to a specific checkpoint name.

## Metrics

| Metric | Floor | Target | Notes |
|--------|-------|--------|-------|
| Cold LLM start | progress UI | < 10 min | weights + expert tier promote |
| Warm LLM reuse | — | < 60 s | `GIM_LLM_KEEP=1` (default), container already up |
| Decode | 5 tok/s | 8+ tok/s | expert cache hit rate dominates |
| Agent tool round | < 60 s | < 20 s | harness + compact + truncate |
| Re-prefill on continue | — | ~0 | `.coli_kv` + warm container |

## P0 — Warm LLM (implemented)

- `GIM_LLM_KEEP=1` (default): `gim stop` keeps Colibri container running.
- `gim stop --full-stop`: removes LLM container.
- Restart reuses running container (`reused: true` in logs).
- Persistent dirs under `~/.gim/cache/llm/<id>/` (tune profiles, optional usage mirror).
- Model mount **read-write** so Colibri can write `.coli_usage` / `.coli_kv` on the host.

## P1 — Universal Colibri env (implemented)

Set via Docker env (override any with host `COLI_*` / `CUDA_*`):

| Variable | Default | Role |
|----------|---------|------|
| `COLI_CUDA` | `1` | GPU tier |
| `COLI_CUDA_PIPE` | `2` | GPU-resident pipeline |
| `COLI_CUDA_TC_W4A16` | `1` | Tensor Core expert matmul |
| `CUDA_EXPERT_GB` | `auto` | VRAM expert tier |
| `PIN_GB` | `all` | RAM expert residency |
| `PIN` | `auto` | Learning cache from `.coli_usage` |
| `PIPE` | `1` | Async expert I/O |
| `URING` | `1` | Linux batched I/O |
| `KVSAVE` | `1` | KV persistence |
| `REPIN` | `256` | Live hot-expert adaptation |

## P2 — Auto-tune

- `GIM_COLIBRI_AUTO_TUNE=1`: run `coli tune` once per cache id (marker file).
- Profiles stored in `~/.gim/cache/llm/<id>/xdg/colibri/tuning/`.

## P3 — Harness

- `GIM_TOOL_MAX_READ` / `GIM_TOOL_MAX_BASH` — smaller tool payloads → less prefill.
- HTTP keep-alive to `/v1` (`src/llm-fetch.js`).
- Context compact @ 72% (`GIM_COMPACT_PCT`).
- Capability probe cached per stack (not per chat).

## P4 — Doctor

```bash
gim doctor --speed
```

Hints: NVMe for model tree, RAM headroom, GPU in Docker, `URING`/`DIRECT`, disable 512K runtime ctx on low RAM.

## Commands

```bash
gim start                    # Colibri Docker default (Win/Linux)
gim stop                     # UI/guest off; LLM stays warm
gim stop --full-stop         # tear down LLM container too
gim doctor --speed
```

Env: `GIM_DEFAULT_LLM=colibri|gguf|api|none` · `GIM_LLM_KEEP=0|1`

## P5 — KV slots, grammar drafts, compact prefill (implemented)

| Feature | Env / API | Role |
|---------|-----------|------|
| **cache_slot** | auto from `chatId` | Colibri isolated KV — zero re-prefill between turns |
| `COLI_KV_SLOTS` | default `8` | Parallel chat contexts in one LLM container |
| **Grammar drafts** | `GIM_GRAMMAR_TOOLS=1` | Universal compact JSON GBNF in Docker |
| **Agent temp 0** | default agent/debug | Greedy + grammar draft acceptance |
| **Compact tool JSON** | `GIM_TOOL_RESULT_MAX` | Smaller prefill after tools |
| **Batch tool results** | `GIM_BATCH_TOOL_RESULTS=1` | Optional merge (off by default) |
| **Multi-GPU** | `COLI_GPUS=0,1` | Optional expert tier spread |
| **Queue** | `COLI_MAX_QUEUE=8` | Fair admission under load |

Disable grammar: `GIM_GRAMMAR_TOOLS=0`. Disable KV slot assignment: omit `chatId` in API (slot 0).

## P6 — Security eval (implemented)

| Feature | Command | Role |
|---------|---------|------|
| **Enforcement pack** | `npm run test:security` | 22 adversarial scenarios — jail, bash deny, static invariants |
| **Bar** | `GIM_SECURITY_BAR=0.95` | ≥95% pass for Hardened claim |
| **Threat model** | `docs/THREAT-MODEL.md` | Trust boundaries, residual risks |
| **OWASP map** | `docs/OWASP-LLM-MAP.md` | LLM01–LLM10 → controls + tests |
| **Doctor** | `gim doctor --security` | Policy score + security eval summary |

Separate from functional eval: `node scripts/honest-eval.mjs`. See [SECURITY-EVAL.md](./SECURITY-EVAL.md).
