---
name: tool-search
description: Deferred Deep tools — search catalog before guessing bash/MCP schemas.
---

# Tool search (deferred catalog)

When unsure which Deep capability to use, search first:

```bash
# via CLI risk/daemon/index — or MCP tools:
# tool_search query="lsp definition"
# tool_select id=lsp_query
```

Catalog ids: `code_search`, `code_index_build`, `lsp_query`, `guest_bash`, `risk_classify`, `daemon_health`, `egress_proxy`, `mcp_bridge`.

Do **not** dump full tool schemas into context until `tool_select` / you need that tool.
