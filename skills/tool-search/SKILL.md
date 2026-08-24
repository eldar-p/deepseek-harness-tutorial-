---
name: tool-search
description: Deferred GIM capabilities — search catalog before guessing bash schemas or CLI flags.
---

# Tool search (deferred catalog)

When unsure which GIM capability applies, **search first** — do not dump full tool schemas into context.

## MCP / harness

```
tool_search  query="lsp definition"
tool_select  id=lsp_query
```

## Catalog ids

| id | Purpose |
|----|---------|
| `code_search` | Semantic index search |
| `code_index_build` | Rebuild index |
| `lsp_query` | LSP def/refs/hover |
| `guest_bash` | Docker guest shell |
| `risk_classify` | Bash/write risk allow/deny |
| `daemon_health` | Background stack poller |
| `egress_proxy` | Outbound HTTP via host proxy |
| `mcp_bridge` | Wire GIM into Cursor / Claude Desktop |
| `doctor_release` | Pre-tag gate (`gim doctor --release`) |
| `doctor_security` | Policy + security eval |
| `colibri_speed` | Warm LLM, ctx cap, KV slots |

Native agent tools (`list_dir`, `read_file`, …) are always available — catalog is for **extended** CLI/MCP features.
