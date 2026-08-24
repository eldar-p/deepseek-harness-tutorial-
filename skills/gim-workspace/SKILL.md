---
name: gim-workspace
description: GIM CLI workspace layout, six agent tools, guest container paths. Read first on any coding task.
---

# GIM workspace (2.0)

## Where files live

| Layer | Host path | In guest (`guest_bash`) |
|-------|-----------|-------------------------|
| Stack workspace | `~/.gim/workspace/<stack>/` | `/workspace/` |
| AI memory | `.gim/memory.json` | same (under workspace) |
| Config | `~/.gim/config.json` | not mounted |
| Chats | `~/.gim/chats/` | host only |

Default stack name: `default`. Multi-stack: `gim start --name dev`.

## Six tools (fixed contract — every model)

1. `list_dir` — relative path under workspace
2. `read_file` — UTF-8 text (default max **8 KB** per read — use `search_files` first)
3. `write_file` — create/update (`.env`, keys, `.git/` → **deny**)
4. `search_files` — regex/glob in workspace (prefer over full reads)
5. `guest_bash` — shell **inside Docker guest** only (no host pwsh/bash)
6. `ask_user` — clarifying question when intent ambiguous

There is **no** host shell tool. Do not assume `curl` on the host works for agent tasks — use `guest_bash`.

## Typical workflow

1. `list_dir` or `search_files` to locate code
2. `read_file` on a small slice (or use [code-search](./../code-search/SKILL.md))
3. `write_file` for edits
4. `guest_bash` for tests, git, package installs (runs in guest at `/workspace`)

## LLM backend (don't branch tools)

Default local: **Colibri in Docker** → `http://127.0.0.1:<port>/v1`.  
Escapes only when user asked: `--gguf`, `--api`, `--vllm`.

Warm LLM: `gim stop` keeps container; `gim stop --full-stop` tears down.

## UI

Native GIM UI: `gim start` → `http://127.0.0.1:<uiPort>/`. DSH is optional (`GIM_USE_DSH=1`).
