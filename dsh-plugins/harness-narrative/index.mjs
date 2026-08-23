/**
 * Harness narrative → Think row: synthesize reasoning blocks from tool activity
 * so DeepSeek Harness shows an expandable Think trail without a thinking model.
 *
 * Listens tools/pre-execute + tools/result, then prepends a reasoning block on
 * the next llm/stream (skipped for purpose=compaction / session-title).
 *
 * Must emit block-start / reasoning-delta / block-end — llm-invariant rejects
 * bare reasoning-delta. tools/pre-execute is a waterfall: always call next().
 */
export const name = 'harness-narrative'
export const inject = []

const MAX_LINES = 24
const MAX_ARG = 160

/** @type {string[]} */
let pending = []

function clip(s, n = MAX_ARG) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function toolLabel(exec) {
  return exec?.name ?? 'tool'
}

function argHint(exec) {
  const args = exec?.arguments ?? {}
  if (typeof args === 'string') return clip(args)
  const name = toolLabel(exec)
  if (name === 'bash' || name === 'Bash') return clip(args.command ?? args.cmd ?? JSON.stringify(args))
  if (name === 'read' || name === 'Read') {
    const p = args.file_path ?? args.path ?? args.filePath ?? ''
    const lim = args.limit != null ? ` limit=${args.limit}` : ''
    const off = args.offset != null ? ` offset=${args.offset}` : ''
    return clip(`${p}${off}${lim}`)
  }
  if (name === 'grep' || name === 'Grep') return clip(`${args.pattern ?? ''} @ ${args.path ?? args.glob ?? '.'}`)
  if (name === 'glob' || name === 'Glob') return clip(args.pattern ?? args.glob ?? JSON.stringify(args))
  if (name === 'write' || name === 'Write' || name === 'edit' || name === 'Edit') {
    return clip(args.file_path ?? args.path ?? JSON.stringify(args))
  }
  try {
    return clip(JSON.stringify(args))
  } catch {
    return ''
  }
}

function pushLine(line) {
  pending.push(line)
  if (pending.length > MAX_LINES) pending = pending.slice(-MAX_LINES)
}

function takeNarrative() {
  if (pending.length === 0) return ''
  const lines = pending
  pending = []
  return `Harness steps:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n`
}

function shiftIndex(chunk, delta) {
  if (chunk == null || typeof chunk !== 'object') return chunk
  if (!('index' in chunk) || typeof chunk.index !== 'number') return chunk
  return { ...chunk, index: chunk.index + delta }
}

function resultHint(result) {
  if (result == null) return 'done'
  if (result.isError) {
    const msg = typeof result.content === 'string'
      ? result.content
      : (Array.isArray(result.content)
        ? result.content.map((c) => c?.text ?? '').join(' ')
        : String(result.content ?? 'error'))
    return `error: ${clip(msg, 80)}`
  }
  const text = typeof result === 'string'
    ? result
    : (typeof result.content === 'string'
      ? result.content
      : (Array.isArray(result.content)
        ? result.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('')
        : ''))
  if (text) return `ok (${Math.min(text.length, 99999)} chars)`
  return 'ok'
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.on('tools/pre-execute', (exec, next) => {
    try {
      const hint = argHint(exec)
      pushLine(`→ ${toolLabel(exec)}${hint ? `: ${hint}` : ''}`)
    } catch {
      /* never block tools */
    }
    return next()
  })

  ctx.on('tools/result', (exec, result) => {
    try {
      pushLine(`← ${toolLabel(exec)}: ${resultHint(result)}`)
    } catch {
      /* ignore */
    }
  })

  ctx.on('llm/stream', (options, next) => {
    const purpose = options?.purpose
    if (purpose === 'compaction' || purpose === 'session-title') {
      return next()
    }
    const narrative = takeNarrative()
    const inner = next()
    if (!narrative) return inner

    return (async function* () {
      // Index 0 = harness Think; shift model chunks by +1 (llm-invariant grammar).
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      yield { type: 'reasoning-delta', index: 0, text: narrative }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: narrative } }
      for await (const chunk of inner) {
        yield shiftIndex(chunk, 1)
      }
    })()
  }, { global: true })
}

export default { name, inject, apply }
