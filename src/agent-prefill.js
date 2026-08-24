/**
 * Agent prefill helpers — compact tool payloads, batched result shape (universal).
 */

const TOOL_CONTENT_MAX = Number(process.env.GIM_TOOL_RESULT_MAX || 24_000)

/** Strip noisy fields from tool results before next LLM turn. */
export function compactToolResult(result) {
  if (result == null) return result
  if (typeof result !== 'object') return result
  const out = { ...result }
  delete out._raw
  delete out.stdout_full
  delete out.stderr_full
  if (typeof out.content === 'string' && out.content.length > TOOL_CONTENT_MAX) {
    out.content = out.content.slice(0, TOOL_CONTENT_MAX)
    out.truncated = true
  }
  if (typeof out.stdout === 'string' && out.stdout.length > TOOL_CONTENT_MAX) {
    out.stdout = out.stdout.slice(0, TOOL_CONTENT_MAX)
    out.truncated = true
  }
  return out
}

export function stringifyToolResult(result) {
  return JSON.stringify(compactToolResult(result)).slice(0, TOOL_CONTENT_MAX)
}

/**
 * Merge consecutive tool role messages at end of history into one user block (optional).
 * Disabled by default — Colibri cache_slot handles KV reuse; compaction is for token savings.
 * @param {object[]} messages
 */
export function batchTrailingToolResults(messages) {
  if (process.env.GIM_BATCH_TOOL_RESULTS === '0') return messages
  const msgs = [...messages]
  const trailing = []
  while (msgs.length && msgs[msgs.length - 1]?.role === 'tool') {
    trailing.unshift(msgs.pop())
  }
  if (trailing.length <= 1) return [...msgs, ...trailing]

  const merged = trailing.map((m) => {
    let body = m.content
    try {
      body = JSON.parse(m.content)
    } catch {
      /* */
    }
    return { id: m.tool_call_id, result: body }
  })
  msgs.push({
    role: 'user',
    content: `[tool results batch]\n${JSON.stringify(merged).slice(0, TOOL_CONTENT_MAX)}`,
    meta: { kind: 'tool_batch' },
  })
  return msgs
}

/** Greedy decode for agent (enables Colibri grammar drafts when armed). */
export function agentTemperature(mode, explicit) {
  if (explicit != null && explicit !== '') return Number(explicit)
  if (process.env.GIM_AGENT_TEMP != null) return Number(process.env.GIM_AGENT_TEMP)
  if (mode === 'agent' || mode === 'debug') return 0
  return 0.3
}

/** response_format for text-fallback tool rounds (Colibri json_object drafting). */
export function textFallbackResponseFormat(enabled) {
  if (enabled === false) return undefined
  if (process.env.GIM_GRAMMAR_TOOLS === '0') return undefined
  return { type: 'json_object' }
}
