/**
 * Universal fallbacks when a model lacks native tool_calls.
 * Same for every backend — never per-model tool schemas.
 */

/** Detect numbered / bulleted clarifying questions in plain assistant text. */
export function extractTextPoll(content) {
  const text = String(content || '').trim()
  if (!text) return null

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const options = []
  for (const line of lines) {
    const m = line.match(/^(?:[-*•]|\d+[.)]|[a-dA-D][.)])\s+(.+)$/)
    if (m) options.push(m[1].trim())
  }

  const asks =
    /would you like|что (?:вам |тебе )?нужно|выбери|choose|which|какой|какую|want me to|prefer/i.test(
      text,
    )

  if (options.length >= 2 && (asks || options.length >= 3)) {
    return {
      title: 'Choose an option',
      questions: [
        {
          id: 'choice',
          prompt: 'What should I do next?',
          options: options.slice(0, 8),
          allowMultiple: false,
          allowFreeText: true,
          required: true,
        },
      ],
    }
  }

  const qlines = lines.filter((l) => /^(?:\d+[.)]|[-*]|Q\d+)\s+.+\?/.test(l) || /\?\s*$/.test(l))
  if (qlines.length >= 2 && asks) {
    return {
      title: 'Clarification',
      questions: qlines.slice(0, 6).map((l, i) => ({
        id: `q${i + 1}`,
        prompt: l.replace(/^(?:\d+[.)]|[-*]|Q\d+)\s+/, ''),
        options: [],
        allowFreeText: true,
        required: true,
      })),
    }
  }

  return null
}

/** Parse ```gim-tool {json} ``` from assistant text (universal non-native-tools protocol). */
export function extractTextToolCall(content) {
  const text = String(content || '')
  const m = text.match(/```gim-tool\s*\r?\n([\s\S]*?)\r?\n```/i)
  if (!m) return null
  try {
    const j = JSON.parse(m[1].trim())
    const name = j.name || j.tool
    if (!name || typeof name !== 'string') return null
    return { name, args: j.args || j.arguments || {} }
  } catch {
    return null
  }
}

/** Soft stream a finished string as SSE-friendly chunks. */
export async function emitChunkedDelta(onEvent, content, { chunkSize = 18, delayMs = 6 } = {}) {
  const text = String(content || '')
  if (!text) {
    onEvent({ type: 'assistant_delta', content: '' })
    return
  }
  for (let i = 0; i < text.length; i += chunkSize) {
    onEvent({ type: 'assistant_delta', content: text.slice(i, i + chunkSize) })
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
  }
}
