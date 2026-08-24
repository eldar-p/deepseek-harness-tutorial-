# Architecture Guide

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRINCIPLES.md](./PRINCIPLES.md) · [SECURITY.md](./SECURITY.md) · [CODE-INDEX.md](./CODE-INDEX.md).

## Big picture

GIM is a **local agent harness**: one CLI on the host orchestrates an LLM, a sandboxed guest shell, optional egress proxy, semantic code index, and a native chat UI. Everything for one project stack lives under `~/.gim/workspace/<stack>/`.

```text
                    ┌─────────────────────────────────────────┐
                    │           GIM CLI (Node 22+, host)       │
                    │  start · doctor · agent loop · tools     │
                    └───────┬─────────┬─────────┬──────────────┘
                            │         │         │
         ┌──────────────────┘         │         └──────────────────┐
         ▼                            ▼                            ▼
  ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
  │ LLM backend  │            │  GIM Guest   │            │   GIM UI     │
  │ OpenAI /v1   │            │ Docker bash  │            │ SPA + SSE    │
  └──────────────┘            └──────────────┘            └──────────────┘
         │                            │                            │
         │                     egress-proxy                  code-index
         │                     (allowlist)                   HTTP :port
         ▼
  Colibri / GGUF / cloud API / vLLM
```

**Trust boundary:** The agent never gets host `pwsh`/`bash`. It uses six fixed tools; risky commands run in **gim-guest** with network optionally routed through **egress-proxy**.

---

## One stack = one isolated world

| Resource | Location / rule |
|----------|-----------------|
| Workspace files | `~/.gim/workspace/<stack>/` (bind-mounted into guest) |
| Run state (ports, URLs) | `~/.gim/run/<stack>.json` |
| Agent memory | `.gim/memory.json` in workspace |
| Code index | `.gim/code-index/` in workspace |
| LLM cache / KV | `~/.gim/cache/llm/<id>/` |

Multi-stack: `gim start --name foo` vs `--name bar` — separate LLM port, guest, UI, index.

---

## Services (what each piece does)

### 1. GIM CLI (`src/` entry, `gim` bin)

**Role:** Orchestrator and developer interface.

- **`gim start`** — Probes manifests, starts LLM (default Colibri Docker), guest container, UI dev server, optional code-index HTTP server, writes run state.
- **`gim doctor`** — Health checks; `gim doctor --release` runs release gate.
- **Agent loop** — Sends messages to LLM with universal tool schema; executes tool calls; streams to UI via SSE.
- **`gim index *`** — Build/search/status for semantic code index (no full stack required).

Does **not** embed model weights; talks to backends over HTTP `/v1`.

### 2. LLM backend (Colibri default)

**Role:** Inference — chat completions + (optionally) embeddings.

| Mode | How started | Endpoint |
|------|-------------|----------|
| **Colibri** (default) | Docker `coli serve` | `http://127.0.0.1:<port>/v1` |
| **GGUF** | `--gguf` → llama-server | same |
| **Cloud** | `--api` + key | remote `/v1` |
| **vLLM** | `--vllm` Docker | same |

Colibri keeps warm containers (`GIM_LLM_KEEP=1`), KV cache on disk (`.coli_kv`), usage learning (`.coli_usage`). Adaptive context cap via `context-policy.js` when RAM &lt; 64GB.

**Agent contract:** One tool list for all models; `probeLlmCapabilities()` + text fallback if native tools unsupported.

### 3. GIM Guest (`gim-guest` Docker image)

**Role:** **Only** place the agent runs shell commands (`guest_bash` tool).

- Workspace mounted read/write at `/workspace`.
- No host shell access.
- Network: default isolated; with egress-proxy, HTTP(S)/DNS go through allowlist proxy.
- Used for builds, tests, git inside sandbox — not for reading secrets from host.

### 4. Egress proxy (`src/egress-proxy.js`)

**Role:** Controlled outbound network for guest (and optionally tools).

- Binds `127.0.0.1`, per-stack port from run state.
- Allowlist domains + method rules; injects host **secrets** (`~/.gim/secrets.json`) for approved hosts only.
- Blocks arbitrary exfiltration; evaluated in security tests (`npm run test:security`).

### 5. Code index (`src/code-index/`)

**Role:** Semantic “find code by meaning” for agent and DSH plugin.

- **Build:** Walk sources → chunk (regex or tree-sitter) → embed (hash or llama) → store.
- **Incremental:** `files.json` content hashes; only changed files re-embedded.
- **Search:** Load chunks on demand; cosine in Worker for large indexes.
- **HTTP server:** `GET /status`, `POST /build`, `POST /search`, `POST /touch`.

See [CODE-INDEX.md](./CODE-INDEX.md) for file layout and env vars.

### 6. GIM UI (`ui/`)

**Role:** Native chat front-end (not a generic static site).

- Vite SPA; connects to CLI SSE for streaming tokens and tool events.
- Binds localhost; port in run state.
- Skills copied to `~/.gim/dsh-home/skills` on bootstrap — procedural guides, not core code.

### 7. Daemon (optional)

**Role:** Background helper for long-running or scheduled tasks (when enabled). Lower priority than CLI/guest/LLM path; not required for basic `gim start`.

### 8. MCP (`gim mcp`)

**Two directions:**

| Direction | Command | Role |
|-----------|---------|------|
| **Server** (GIM → IDE) | `gim mcp` | stdio JSON-RPC: code_search, tool_search, stack_status |
| **Client** (GIM → external) | `gim mcp client add/list/doctor` | Registry `~/.gim/mcp-servers.json`; agent tools `mcp_list_tools`, `mcp_call` |

Agent loop merges external MCP when servers configured (`GIM_MCP_TOOLS=1` forces tool schema even without servers).

### 9. AI instructions (`.gim/ai-instructions.md`)

**Role:** AGENTS.md-compatible project context — build/test commands, CI, MCP list, memory facts.

```bash
gim instructions init | refresh | sync [--write-agents]
```

Injected into agent system prompt automatically. Seeded on bootstrap/start via `materializeAssets`.

### 10. MCP server module (`src/mcp-server.js`)

**Role:** Expose GIM capabilities to external MCP clients (e.g. IDE integrations) — index status, workspace paths, etc.

---

## Agent tools (fixed contract)

| Tool | Purpose |
|------|---------|
| `list_dir` | Directory listing in workspace |
| `read_file` | Read file (size-capped, default 8KB via `GIM_TOOL_MAX_READ`) |
| `write_file` | Write file; may trigger index touch |
| `search_files` | Ripgrep-style text search |
| `guest_bash` | Shell in guest container |
| `ask_user` | Blocking question to user in UI |

Tool results can be batched (`GIM_BATCH_TOOL_RESULTS`, on by default) to reduce LLM round-trips.

---

## Typical request flow (chat turn)

```text
User message (UI)
    → CLI agent loop
    → LLM /v1/chat/completions (tools in schema)
    ← tool_call: read_file / search_files / guest_bash / …
    → CLI executes tool (host or guest)
    → tool result back to LLM
    ← assistant text (+ maybe more tools)
    → SSE stream to UI
```

Code search via index:

```text
Agent or plugin
    → POST code-index/search { query }
    → embed query + cosine over chunks (Worker if large)
    ← hits: path, symbol, lines, score
```

---

## Security summary

- Host exec **disabled** for agent.
- Logs: structured events, not full prompts (see SECURITY docs).
- Manifests verified (sha256) from `manifests/` + cache.
- Release gate: `gim doctor --release`, CI security + honest-eval hooks.

---

## What to optimize next (without Rust)

Already in JS (code index):

1. Incremental index (`files.json` hashes)
2. Cosine batch in Worker Thread
3. Lazy load — `status` reads `meta.json` only; chunks on search

Later native ROI: Rust **sidecar** for index search/build at 100k+ chunks; keep HTTP API stable.
