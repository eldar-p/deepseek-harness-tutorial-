/**
 * Auto-compact long conversations (Cursor-style) before they hit the context ceiling.
 */
import { estimateContextUsage, estimateTokens } from './context-estimate.js'
import { DEFAULT_COMPACT_PCT, COMPACT_KEEP_MESSAGES } from './context-policy.js'
import { llmFetch } from './llm-fetch.js'

function heuristicSummary(messages) {
  const lines = []
  for (const m of messages) {
    const role = m.role || 'unknown'
    const text = String(m.content || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    lines.push(`- ${role}: ${text.slice(0, 280)}${text.length > 280 ? '…' : ''}`)
  }
  return lines.join('\n').slice(0, 14_000)
}

async function llmSummarize(target, messages, model) {
  const blob = heuristicSummary(messages)
  const body = {
    model: model || target.model,
    messages: [
      {
        role: 'system',
        content:
          'Summarize the conversation for context compression. Keep facts, file paths, decisions, errors. Be concise.',
      },
      { role: 'user', content: blob },
    ],
    temperature: 0,
    max_tokens: 1200,
    stream: false,
  }
  try {
    const res = await llmFetch(`${target.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey || 'sk-gim-local'}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

/**
 * @param {{
 *   messages: object[],
 *   contextWindow: number,
 *   mode?: string,
 *   system?: string,
 *   target?: { baseURL: string, model: string, apiKey?: string } | null,
 *   model?: string,
 *   compactPct?: number,
 * }} opts
 */
export async function compactMessagesIfNeeded(opts) {
  const messages = [...(opts.messages || [])]
  const contextWindow = opts.contextWindow || 512_000
  const compactPct = opts.compactPct ?? DEFAULT_COMPACT_PCT
  const usage = estimateContextUsage({
    mode: opts.mode || 'agent',
    messages,
    contextWindow,
    system: opts.system,
  })

  if (usage.pct < compactPct || messages.length <= COMPACT_KEEP_MESSAGES + 2) {
    return { messages, compacted: false, usage }
  }

  const keep = Math.max(4, COMPACT_KEEP_MESSAGES)
  const old = messages.slice(0, -keep)
  const recent = messages.slice(-keep)
  if (old.length < 2) return { messages, compacted: false, usage }

  let summary = heuristicSummary(old)
  if (opts.target?.baseURL) {
    const llm = await llmSummarize(opts.target, old, opts.model)
    if (llm) summary = llm
  }

  const compactedMessages = [
    {
      role: 'user',
      content: `[Summarized conversation — ${old.length} earlier messages, ~${estimateTokens(summary)} tokens]\n${summary}`,
      meta: { kind: 'compact_summary' },
    },
    ...recent,
  ]

  const usageAfter = estimateContextUsage({
    mode: opts.mode || 'agent',
    messages: compactedMessages,
    contextWindow,
    system: opts.system,
  })

  return {
    messages: compactedMessages,
    compacted: true,
    dropped: old.length,
    usage: usageAfter,
    summaryPreview: summary.slice(0, 400),
  }
}
