# Claude Code leak — triage for GIM CLI

**Sources reviewed:**
- [gitlawb explorer](https://explorer.gitlawb.com/repos/z6MkgKkbqz2sLMtUWW7LwVqiBePw1pCEmvbHdVnpc2dam4XS/chatgptprojects-claude-code) — shows full `src/` tree (~785 KB `main.tsx`, tools, coordinator, MCP, LSP)
- GitHub `chatgptprojects/claude-code` — **NOT the leak**; redirects to **clear-code** marketing repo (skills/tests only)
- Full source mirror: `vseeliu/claude-code-source` (local grep, March 2026 leak)

**Legal:** Anthropic IP. Use for **architecture study only** — do not copy code verbatim into GIM CLI.

---

## Verdict: есть полезное, но не «скопировать репо целиком»

| Area | Useful for GIM? | What to borrow (pattern, not paste) |
|------|------------------|-------------------------------------|
| **ToolSearchTool** | ✅ High | Deferred tools: model starts with search-only tool, loads MCP/bash schemas on demand → saves context. GIM: MCP `code_search` + thin tool set in Cordis. |
| **Coordinator mode** | ✅ High | Lead agent spawns workers with **subset of tools** + scratchpad dir. GIM: parallel DSH stacks or `gim agent spawn` with clean context. |
| **Auto mode (yoloClassifier)** | ✅ Medium | Separate **LLM classifier** with allow / soft_deny / environment rules before bash/write. GIM: start with **heuristic** `permission-risk.js`, optional llama classifier later. |
| **memdir / MEMORY.md** | ✅ Medium | Entrypoint cap 200 lines / 25 KB, topic files, truncation warnings. GIM: extend `.gim/memory.json` + `CONTEXT.md` with same caps (ADR 0006). |
| **LSPTool** | ✅ Medium | goToDefinition, references, hover, workspace symbols via LSP manager. GIM: Cordis plugin calling `typescript-language-server` / `pyright` on host. |
| **MCP services** | ✅ High | Config from JSON, server approval, scoped tools. GIM: **`gim mcp`** stdio server wrapping index + guest status (implemented). |
| **Compact / pruner** | ✅ Already | GIM has `compaction-basic` + `tool-result-pruner` in cordis patch. |
| **Kairos / PROACTIVE** | ⚠️ Low now | Background daemon, tick messages, channels — heavy, needs always-on process. Phase 2: `gim daemon`. |
| **Undercover mode** | ❌ Skip | Strips AI attribution from commits in public repos — ethically toxic; not aligned with GIM transparency. |
| **Ink/React TUI (785 KB main.tsx)** | ❌ Skip | GIM uses DSH web UI, not terminal REPL. |
| **Analytics / Growthbook / Statsig** | ❌ Skip | Telemetry gates; GIM is telemetry-off by design. |
| **Team agents / SleepTool / Voice** | ❌ Skip | Enterprise/experimental; out of scope for local llama stack. |

---

## Top 5 steals (ranked)

### 1. ToolSearch + deferred MCP tools
Claude Code keeps **hundreds of tool schemas out of context** until `ToolSearch` matches keywords (`+slack`, `select:bash`).  
**GIM action:** MCP server exposes `tool_search` / `tool_select` + `code_search`; Cordis persona prefers search before inventing tools.

### 2. Coordinator + AgentTool
`coordinatorMode.ts`: lead uses `AgentTool` to spawn workers with `ASYNC_AGENT_ALLOWED_TOOLS` minus internal tools; scratchpad under injected dir.  
**GIM action:** `scripts/coordinator.mjs` — split task → N × `gim index search` + focused read in parallel (host-side, no Anthropic code).

### 3. Auto mode classifier
`yoloClassifier.ts`: second LLM call classifies tool use into allow / confirm / deny using rule templates.  
**GIM action:** `src/permission-risk.js` — regex tiers + optional LLM second-pass (`GIM_AUTO_MODE=llm`, `gim risk classify --llm`).

### 4. memdir memory budget
`memdir.ts`: hard caps on MEMORY.md, one-line index entries, «move detail to topic files».  
**GIM action:** validate `memory.template.json` size at bootstrap; warn in doctor.

### 5. LSP as first-class tool
`LSPTool.ts`: unified tool for definition / references / hover / workspaceSymbol.  
**GIM action:** `dsh-plugins/lsp-bridge/` — spawn LSP child, expose compact JSON to agent (next sprint).

---

## gitlawb vs GitHub mismatch

The **gitlawb explorer** indexes the leaked file tree. The linked GitHub repo **`chatgptprojects/claude-code`** currently clones as **clear-code** (comparison/marketing + skills package), **without** `src/QueryEngine.ts`, `src/coordinator/`, etc.

To read real sources locally:
```bash
git clone --depth 1 https://github.com/vseeliu/claude-code-source.git
# or unpack from npm @anthropic-ai/claude-code cli.js.map (see leak README)
```

---

## GIM CLI mapping (implemented / planned)

| Claude Code | GIM CLI status |
|-------------|-----------------|
| Codebase semantic search | ✅ `gim index search` + LanceDB optional |
| MCP tools | ✅ `node scripts/gim-mcp.mjs` (stdio) |
| Egress proxy + secrets | ✅ `egress-proxy` sidecar |
| Auto approve bash | ✅ heuristic + optional LLM (`GIM_AUTO_MODE=llm`) |
| Coordinator subagents | ✅ `scripts/coordinator.mjs` (index-parallel workers) |
| LSP integration | ✅ `dsh-plugins/lsp-bridge` + `src/lsp-bridge.js` |
| Kairos daemon | ✅ `gim daemon` + proactive `.gim/PROACTIVE.md` |
| ToolSearch deferred tools | ✅ `tool_search` / `tool_select` MCP + skill |
| Undercover commits | ❌ rejected |

See [0008-code-index-egress-proxy.md](../adr/0008-code-index-egress-proxy.md).
