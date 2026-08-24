# Quant policy (GGUF quality)

Deep treats **Q4_K_M** as the minimum for reliable tool-heavy agents.

## Surfaces

| Place | Behavior |
|-------|----------|
| `deep start` | `[YELLOW]`/`[RED]` + `[HINT]`; writes `.deep/QUANT.md` when weak |
| `deep status` | **Quant** row (GREEN / YELLOW / RED) |
| `deep doctor` | `quant` line + soft-policy note |

## Soft policy (`deep start`)

| Tier | Example | Default |
|------|---------|---------|
| recommended | Q4_K_M+ | OK |
| acceptable | IQ4… | WARN |
| degraded | Q3_K_M | WARN + `.deep/QUANT.md` |
| severe | Q2 / Q1 | **blocked** unless `--force-quant` |

Flags / env:

```bash
deep start --require-q4          # fail unless Q4_K_M+ (or API mode)
deep start --force-quant         # allow severe / bypass --require-q4
DEEP_REQUIRE_Q4=1 deep start
DEEP_FORCE_QUANT=1 deep start
```

## DSH agent hints

Low quant → workspace `.deep/QUANT.md` (tool budget). Cordis persona and `AGENTS.md` tell the agent to follow it.

## Upgrade

```bash
deep start --gguf /path/model.Q4_K_M.gguf
```

See [OS-COMPAT.md](./OS-COMPAT.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#q3-quant-warnings).
