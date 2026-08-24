# Architecture

```text
User
  │
  ▼
deep CLI (host, Node 22+)
  ├── Model backend (one of)
  │     ├── llama-server (local GGUF, 127.0.0.1:PORT/v1)
  │     └── cloud API (OpenAI-compatible, --api PROVIDER)
  ├── manifests/ + ~/.deep/manifests-cache  (sha256 verify)
  ├── deep-guest (container, exec bash only)
  ├── egress-proxy (allowlist; secrets on host)
  ├── code-index (semantic search HTTP)
  └── DSH web (host, 127.0.0.1:PORT/)
        └── tools → guest / workspace jail
```

Deep is **not local-only**: use `--api` for OpenAI-compatible cloud models while keeping the same guest sandbox, index, and DSH UI on your machine.

## One stack

1 stack = 1 llama + 1 guest container + 1 DSH instance. Multi-stack via `--name`.

## Presets

Network + zero-traces: `balanced` (default), `dev`, `offline`, `paranoia`, `open`.

## Context layers

| Layer | Location |
|-------|----------|
| Code / logs | `~/.deep/workspace/<stack>/` |
| AI facts | `.deep/memory.json` |
| Session | DSH (compact 5–10 + summary at beta) |
| KV | llama (dropped on stop) |

## Security model (target)

- Host pwsh/bash **off** for agent; guest-exec only
- Logs: events only, no prompts
- `127.0.0.1` bind; free ports per stack

Pre-alpha: guest requires Docker Desktop/Podman; first `deep start` builds `deep-guest:prealpha`. Full workspace jail at alpha.
