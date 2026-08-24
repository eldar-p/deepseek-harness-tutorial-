# GIM Diagnostics

Structured error service — know **what broke**, **why**, and **what to do**.

## Commands

```bash
gim diagnose                    # full health scan + recent errors
gim diagnose --logs             # include log file tails
gim diagnose --last 20          # show last N recorded errors only
gim diagnose --json             # machine-readable report
gim diagnose --clear            # wipe stack diagnostic log
gim diagnose --name my-stack
```

## Error codes

Catalog: `assets/diagnostics-catalog.json`

| Code | Component | Typical cause |
|------|-----------|---------------|
| `GIM-DOCKER-001` | docker | Engine not running |
| `GIM-COLIBRI-001` | colibri | Linux ELF engine missing (Docker) |
| `GIM-COLIBRI-002` | colibri | Model path invalid |
| `GIM-COLIBRI-003` | colibri | Warming timeout |
| `GIM-LLM-001` | llm | Backend failed to start |
| `GIM-GGUF-001` | gguf | GGUF file missing |
| `GIM-GUEST-001` | guest | Guest container down |
| `GIM-INDEX-001` | index | Index not built |
| `GIM-MCP-001` | mcp | External MCP server failed |
| `GIM-CONFIG-001` | config | Not bootstrapped |

On any CLI failure, GIM prints `[HINT] CODE: fix` and appends to the diagnostic log.

## Log file

`~/.gim/diagnostics/<stack>.jsonl` — one JSON object per line (timestamp, code, message, hint).

## When to use

| Situation | Command |
|-----------|---------|
| `gim start` failed | `gim diagnose --logs` |
| Colibri 600s warming | `gim diagnose` → check `GIM-COLIBRI-001` |
| Agent tools empty / guest bash fails | `gim diagnose` → guest + docker |
| MCP integration broken | `gim mcp doctor` + `gim diagnose --last 10` |

See also: `gim doctor`, `gim doctor --speed`, `docs/SPEED.md`.
