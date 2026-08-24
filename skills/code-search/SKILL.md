---
name: code-search
description: Semantic code index for large repos — gim index build/search before bulk grep or read_file.
---

# Code search (GIM index)

Use when the workspace has **50+ source files** or grep returns noise.

## Commands (host CLI)

```bash
gim index build --name STACK
gim index search "authentication middleware" --name STACK
gim index status --name STACK
```

## Agent workflow

1. `gim index build` once per session (or after large refactors).
2. `gim index search "<natural language>"` **before** bulk `search_files` / `read_file`.
3. Open only the top 1–3 hits (path + line range).

## HTTP API (stack running)

`GIM_INDEX_URL` — default `http://127.0.0.1:<indexPort>`

```http
POST /search
{ "query": "...", "limit": 8 }
```

## Optional AST + LanceDB

```bash
cd optional/code-index && npm install
```

Without optional deps: regex chunks + JSON store + hash embeddings (still works).

## Combine with LSP

Index = fuzzy/natural language. LSP = precise def/refs — see [lsp](../lsp/SKILL.md).
