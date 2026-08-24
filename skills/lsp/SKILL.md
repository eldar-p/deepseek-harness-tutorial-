---
name: lsp
description: Host language-server navigation — definition, references, hover. Workspace-relative paths.
---

# LSP bridge

Precise navigation for TS/JS/Python (runs on **host**, not in guest).

## CLI

```bash
gim lsp servers
gim lsp query --op definition --path src/foo.ts --line 10 --character 4
gim lsp hover --path src/foo.py --line 1 --character 0
```

## MCP / deferred tools

- `lsp_servers` — installed servers on PATH
- `lsp_query` — `{ op, path, line?, character? }`

## Install servers (host)

```bash
npm i -g typescript-language-server typescript   # JS/TS
npm i -g pyright                                 # Python
```

Missing server → clear error; fall back to `gim index search` or `search_files`.

## Paths

Workspace-relative (same as agent `read_file` paths). Guest sees files at `/workspace/...`.
