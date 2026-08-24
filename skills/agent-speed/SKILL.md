---
name: agent-speed
description: Keep GIM agent turns fast — search_files before read_file, small windows, warm Colibri, batch tool results.
---

# Agent speed (GIM 2.0)

See also [docs/SPEED.md](../../docs/SPEED.md).

## Do

- **`search_files`** / `grep` in `guest_bash` before `read_file`
- For huge files: pattern → read only a window ([search-large-files](../search-large-files/SKILL.md))
- `read_file` targets ≤ **8 KB** effective (host truncates; search first)
- One concern per turn: one search → one read slice → one write or bash check
- Large apps: subfolder under workspace + modular files ([large-project](../large-project/SKILL.md))
- UI pages: real CSS/fonts ([frontend-ui](../frontend-ui/SKILL.md))
- Status text: `[OK]` / `[FAIL]` / `[WARN]` — no emoji in source

## Colibri / harness (universal — no per-model profiles)

- Warm LLM: `GIM_LLM_KEEP=1` (default) — `gim stop` keeps container
- Per-chat KV: automatic `cache_slot` from `chatId`
- Grammar drafts for tool JSON: `GIM_GRAMMAR_TOOLS` (default on)
- Batch tool results: on by default (`GIM_BATCH_TOOL_RESULTS=0` to disable)
- RAM < 64 GB: runtime ctx auto-capped at **128K** unless `GIM_CTX` set
- Probe: `gim doctor --speed`

## Don't

- Read multi-kLoC files end-to-end
- `cat` whole dumps into context via bash
- Host shell (not available to agent)
- Repeat `list_dir` / `pwd` between every small edit
- Second farewell summary paragraph

## Paths

- Agent tools: **workspace-relative** paths only (`src/foo.js`, not `C:\...`)
- Guest bash: `cd /workspace && ...` — same files as host workspace mount
