# Quant policy (GGUF quality)

GIM treats **Q4_K_M** as the minimum for reliable tool-heavy agents.

## Surfaces

| Place | Behavior |
|-------|----------|
| `gim start` | `[YELLOW]`/`[RED]` + `[HINT]`; writes `.gim/QUANT.md` when weak |
| `gim status` | **Quant** row (GREEN / YELLOW / RED) |
| `gim doctor` | `quant` line + soft-policy note |

## Soft policy (`gim start`)

| Tier | Example | Default |
|------|---------|---------|
| recommended | Q4_K_M+ | OK |
| acceptable | IQ4… | WARN |
| degraded | Q3_K_M | WARN + `.gim/QUANT.md` |
| severe | Q2 / Q1 | **blocked** unless `--force-quant` |

Flags / env:

```bash
gim start --require-q4          # fail unless Q4_K_M+ (or API mode)
gim start --force-quant         # allow severe / bypass --require-q4
GIM_REQUIRE_Q4=1 gim start
GIM_FORCE_QUANT=1 gim start
```

## DSH agent hints

Low quant → workspace `.gim/QUANT.md` (tool budget). Cordis persona and `AGENTS.md` tell the agent to follow it.

## Upgrade

```bash
gim start --gguf /path/model.Q4_K_M.gguf
```

See [OS-COMPAT.md](./OS-COMPAT.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#q3-quant-warnings).
