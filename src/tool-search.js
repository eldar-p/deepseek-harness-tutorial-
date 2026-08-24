/**
 * Deferred tool catalog (ToolSearch pattern).
 * Agents start with thin schemas; search/select expands descriptions on demand.
 */

/** @typedef {{ id: string, keywords: string[], summary: string, detail: string, when: string }} DeferredTool */

/** @type {DeferredTool[]} */
export const DEFERRED_TOOLS = [
  {
    id: 'code_search',
    keywords: ['search', 'index', 'semantic', 'symbol', 'find code', 'grep alternative'],
    summary: 'Semantic code search over workspace index',
    detail:
      'Use gim index search / MCP code_search before bulk Grep. Requires gim index build once.',
    when: 'Large repos, unknown symbol locations',
  },
  {
    id: 'code_index_build',
    keywords: ['index', 'rebuild', 'reindex', 'lance'],
    summary: 'Rebuild semantic code index',
    detail: 'gim index build — scans workspace; may take minutes.',
    when: 'Empty index or after large refactors',
  },
  {
    id: 'lsp_query',
    keywords: ['lsp', 'definition', 'references', 'hover', 'symbols', 'typescript', 'pyright'],
    summary: 'Language-server navigation on host',
    detail: 'gim lsp query|hover|definition|references|symbols — needs tsserver/pyright installed.',
    when: 'Precise go-to-def / refs in TS/JS/Python',
  },
  {
    id: 'guest_bash',
    keywords: ['bash', 'shell', 'docker', 'guest', 'container', 'cwd'],
    summary: 'Shell inside gim-guest container',
    detail: 'Tool bash runs in guest at /workspace. Host shell disabled.',
    when: 'Installs, tests, git, any shell work',
  },
  {
    id: 'risk_classify',
    keywords: ['risk', 'deny', 'allow', 'auto-mode', 'destructive', 'rm'],
    summary: 'Classify bash risk allow|confirm|deny',
    detail: 'gim risk classify "cmd" [--llm]. Guard denies heuristic/LLM deny.',
    when: 'Before risky shell; policy debugging',
  },
  {
    id: 'daemon_health',
    keywords: ['daemon', 'health', 'llama', 'dsh', 'uptime', 'proactive'],
    summary: 'Background stack health poller',
    detail: 'gim daemon start|tick — writes proactive nudge when unhealthy.',
    when: 'Long sessions; keep llama/DSH alive',
  },
  {
    id: 'egress_proxy',
    keywords: ['proxy', 'egress', 'secrets', 'network', 'allowlist'],
    summary: 'Host egress proxy + secrets.json',
    detail: 'Outbound from guest via host proxy; secrets never mounted into guest.',
    when: 'External HTTP/API calls from agent tools',
  },
  {
    id: 'mcp_bridge',
    keywords: ['mcp', 'cursor', 'claude desktop', 'stdio', 'resources', 'prompts'],
    summary: 'GIM MCP stdio server',
    detail:
      'gim mcp  OR  node scripts/gim-mcp.mjs — code_search + tool_search + project_instructions. External: gim mcp client add/list/doctor; resources/prompts via mcp_list_tools kind=all.',
    when: 'Wire GIM tools into Cursor / Claude Desktop',
  },
  {
    id: 'ai_instructions',
    keywords: ['agents.md', 'ai-instructions', 'project context', 'conventions'],
    summary: 'Smart project instructions',
    detail: 'gim instructions init|refresh|sync → .gim/ai-instructions.md (AGENTS.md compatible). Injected into agent system prompt.',
    when: 'New repo, monorepo onboarding, publish AGENTS.md',
  },
  {
    id: 'doctor_release',
    keywords: ['release', 'tag', 'rc', 'pre-beta', 'ship'],
    summary: 'Pre-tag release gate',
    detail: 'gim doctor --release — RC readiness + audit:prebeta + audit:security + security eval.',
    when: 'Before versioning or publishing 2.x',
  },
  {
    id: 'doctor_security',
    keywords: ['security', 'owasp', 'eval', 'policy', 'jail'],
    summary: 'Security posture + adversarial eval',
    detail: 'gim doctor --security · npm run test:security · npm run smoke:egress.',
    when: 'Verify enforcement bar; after security changes',
  },
  {
    id: 'colibri_speed',
    keywords: ['colibri', 'warm', 'kv', 'grammar', 'ctx', 'speed', 'prefill'],
    summary: 'Colibri universal speed knobs',
    detail: 'GIM_LLM_KEEP, cache_slot, GIM_GRAMMAR_TOOLS, adaptive ctx cap — see docs/SPEED.md · gim doctor --speed.',
    when: 'Slow agent turns; cold start; OOM on large ctx',
  },
]

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {DeferredTool[]}
 */
export function searchDeferredTools(query, { limit = 6 } = {}) {
  const q = String(query || '')
    .toLowerCase()
    .trim()
  if (!q) return DEFERRED_TOOLS.slice(0, limit)

  const tokens = q.split(/[\s,+]+/).filter(Boolean)
  const scored = DEFERRED_TOOLS.map((t) => {
    const hay = `${t.id} ${t.keywords.join(' ')} ${t.summary} ${t.detail}`.toLowerCase()
    let score = 0
    for (const tok of tokens) {
      if (hay.includes(tok)) score += tok.length > 2 ? 2 : 1
      if (t.id === tok || t.keywords.includes(tok)) score += 3
    }
    if (q.startsWith('+') && t.id === q.slice(1)) score += 10
    if (q.startsWith('select:') && t.id === q.slice(7)) score += 10
    return { t, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return (scored.length ? scored.map((x) => x.t) : DEFERRED_TOOLS).slice(0, limit)
}

/**
 * @param {string} id
 * @returns {DeferredTool|null}
 */
export function selectDeferredTool(id) {
  const key = String(id || '')
    .replace(/^(select:|\+)/, '')
    .trim()
  return DEFERRED_TOOLS.find((t) => t.id === key) || null
}

export function formatToolSearchHits(hits) {
  if (!hits.length) return 'no deferred tools matched'
  return hits
    .map((t) => `[${t.id}] ${t.summary}\n  when: ${t.when}\n  keywords: ${t.keywords.join(', ')}`)
    .join('\n\n')
}
