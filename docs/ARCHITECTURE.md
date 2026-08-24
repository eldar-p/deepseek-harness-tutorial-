# Architecture

See **[ARCHITECTURE-GUIDE.md](./ARCHITECTURE-GUIDE.md)** (detailed services) · **[CODE-INDEX.md](./CODE-INDEX.md)** · **[PRINCIPLES.md](./PRINCIPLES.md)** · **[SPEED.md](./SPEED.md)**.

```text
User
  │
  ▼
GIM CLI (host, Node 22+)
  ├── LLM (default Win/Linux)
  │     └── Colibri in Docker → OpenAI /v1 (persistent warm + ~/.gim/cache/llm)
  ├── Optional: llama GGUF (--gguf) · cloud (--api) · vLLM Docker (--vllm)
  ├── manifests/ + ~/.gim/manifests-cache  (sha256 verify)
  ├── gim-guest (container, exec bash only)
  ├── egress-proxy (allowlist; secrets on host)
  ├── code-index (semantic search HTTP)
  └── GIM UI (native SPA, SSE agent loop)
```

GIM is **not local-only**: `--api` for cloud; default local path is **Colibri Docker**, one harness.

## Universal tools (all models)

GIM exposes **one fixed tool contract** to every backend:

`list_dir` · `read_file` · `write_file` · `search_files` · `guest_bash` · `ask_user`

We do **not** ship per-model tool schemas, agent profiles, or OS-specific LLM launchers in core.

| Backend | How GIM talks to it |
|---------|---------------------|
| **Colibri (default)** | Docker `coli serve` → `/v1` |
| llama-server (GGUF) | `--gguf` → `/v1` |
| Cloud API | `--api` → `/v1` |
| vLLM (optional) | `--vllm` Docker → `/v1` |

Runtime `probeLlmCapabilities()` + universal `gim-tool` text fallback — one agent loop.

## Agent skills

Bundled under `skills/` — index [skills/README.md](../skills/README.md). Copied to `~/.gim/dsh-home/skills` on bootstrap. Guide long agent tasks (speed, security, index, egress) without per-model prompts in core.

## One stack

1 stack = 1 LLM endpoint + 1 guest + UI/index. Multi-stack via `--name`.

## Context layers

| Layer | Location |
|-------|----------|
| Code / logs | `~/.gim/workspace/<stack>/` |
| AI facts | `.gim/memory.json` |
| Colibri learning | `.coli_usage` on model dir + `~/.gim/cache/llm/<id>/` |
| KV | `.coli_kv` + warm LLM container (`GIM_LLM_KEEP=1`) |

## Security model

- Host pwsh/bash **off** for agent; guest-exec only
- Logs: events only, no prompts
- `127.0.0.1` bind; free ports per stack
- Enforcement: [SECURITY-EVAL.md](./SECURITY-EVAL.md) · [THREAT-MODEL.md](./THREAT-MODEL.md)
