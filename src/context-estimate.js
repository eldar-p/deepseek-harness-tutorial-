/**
 * Estimate context usage for GIM UI (char/4 heuristic — good enough for the meter).
 */
import { toolsForMode, modesWithTools, AGENT_SYSTEM_EXTRA, ASK_PLAN_SYSTEM_EXTRA } from './agent-tools.js'

export function estimateTokens(text) {
  const s = String(text || '')
  if (!s) return 0
  return Math.max(1, Math.ceil(s.length / 4))
}

function toolsJson(mode) {
  if (!modesWithTools(mode)) return '[]'
  return JSON.stringify(toolsForMode(mode))
}

/**
 * @param {{
 *   mode?: string,
 *   model?: string,
 *   messages?: object[],
 *   contextWindow?: number,
 *   system?: string,
 * }} opts
 */
export function estimateContextUsage(opts = {}) {
  const mode = opts.mode || 'agent'
  const contextWindow = Number(opts.contextWindow || process.env.GIM_CTX || 512_000)
  const extra = mode === 'ask' || mode === 'plan' ? ASK_PLAN_SYSTEM_EXTRA : AGENT_SYSTEM_EXTRA
  const system = `${opts.system || ''}\n\n${modesWithTools(mode) ? extra : ''}`.trim()

  const buckets = [
    { id: 'system', label: 'System prompt', color: '#8b949e', tokens: estimateTokens(system) },
    {
      id: 'tools',
      label: 'Tool definitions',
      color: '#a371f7',
      tokens: modesWithTools(mode) ? estimateTokens(toolsJson(mode)) : 0,
    },
    { id: 'rules', label: 'Rules / hints', color: '#3fb950', tokens: 0 },
    { id: 'skills', label: 'Skills', color: '#d29922', tokens: 0 },
    { id: 'mcp', label: 'MCP & dynamic tools', color: '#8957e5', tokens: 0 },
    { id: 'attachments', label: 'Attachments', color: '#58a6ff', tokens: 0 },
    { id: 'conversation', label: 'Conversation', color: '#f778ba', tokens: 0 },
  ]

  const byId = Object.fromEntries(buckets.map((b) => [b.id, b]))
  for (const m of opts.messages || []) {
    const t = estimateTokens(m.content || '')
    if (m.meta?.kind === 'clarify_reply' || m.role === 'user') {
      if (String(m.content || '').includes('Attached:')) byId.attachments.tokens += t
      else byId.conversation.tokens += t
    } else {
      byId.conversation.tokens += t
      if (Array.isArray(m.tools)) {
        byId.tools.tokens += estimateTokens(JSON.stringify(m.tools).slice(0, 8000))
      }
    }
  }

  const used = buckets.reduce((a, b) => a + b.tokens, 0)
  const pct = contextWindow > 0 ? Math.min(100, Math.round((used / contextWindow) * 100)) : 0

  return {
    contextWindow,
    used,
    pct,
    buckets: buckets.filter((b) => b.tokens > 0 || ['system', 'tools', 'conversation'].includes(b.id)),
  }
}
