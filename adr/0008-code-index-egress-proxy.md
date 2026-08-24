# ADR 0008: Code index + egress sidecar proxy

## Status
Accepted — 2026-08-24

## Context
GIM agent relied on manual file reads and grep. Guest container received network policy via iptables only; API secrets could leak via env vars. Competitors (Aide, Continue, Cline, agent-sandbox) use semantic indexing and sidecar egress.

## Decision

### 1. Code index (host-side)
- `src/code-index/*` — chunker (regex + optional tree-sitter), embedder (llama `/embeddings` or hash fallback), JSON/LanceDB store
- HTTP service on `127.0.0.1:<indexPort>` started with stack
- CLI: `gim index build|search|status`
- DSH plugin `code-search` — incremental `/touch` after writes; hints on large grep
- Optional deps in `optional/code-index/` — core package stays zero-deps

### 2. Egress sidecar proxy (host-side)
- `src/egress-proxy.js` — allowlist forward proxy; reads `~/.gim/secrets.json` on host only
- Guest gets `HTTP_PROXY=http://host.docker.internal:<port>` — never sees secrets file
- iptables in guest remain as defense-in-depth (`GIM_NET_MODE=proxy`)
- Secret header injection applies to plain HTTP requests; HTTPS CONNECT is allowlist tunnel only

## Consequences
- Large repos: agent should `gim index search` before bulk reads
- Users edit `~/.gim/secrets.template.json` → `secrets.json` (mode 600)
- Future: MCP server wrapping index + proxy APIs; LSP/linter plugin; coordinator subagents
