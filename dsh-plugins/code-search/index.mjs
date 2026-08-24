/**
 * Code search integration for GIM DSH.
 * - Auto-incremental index on write/edit
 * - Injects code-search hint when grep/read large trees
 *
 * Env: GIM_INDEX_URL (http://127.0.0.1:PORT), GIM_WORKSPACE
 */
export const name = 'code-search'
export const inject = []

const CODE_EXTS = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs)$/i

function writePath(exec) {
  const a = exec?.arguments ?? {}
  return String(a.file_path ?? a.path ?? a.filePath ?? '')
}

async function reindexRel(rel) {
  const base = process.env.GIM_INDEX_URL
  if (!base || !rel) return
  try {
    await fetch(`${base.replace(/\/$/, '')}/touch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: rel }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    /* best-effort — full rebuild via gim index build */
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.on('tools/result', (exec, result) => {
    try {
      const tool = exec?.name ?? ''
      if (tool === 'write' || tool === 'Write' || tool === 'edit' || tool === 'Edit') {
        const p = writePath(exec)
        if (CODE_EXTS.test(p)) {
          const rel = p.replace(/^.*[/\\]workspace[/\\]/i, '').replace(/\\/g, '/')
          void reindexRel(rel)
        }
      }
      if ((tool === 'grep' || tool === 'Grep') && result && !result.isError) {
        const text = typeof result.content === 'string'
          ? result.content
          : (Array.isArray(result.content) ? result.content.map((c) => c?.text ?? '').join('') : '')
        if (text.length > 12000 && process.env.GIM_INDEX_URL) {
          pushHint('Large grep result — prefer: gim index search "your question"')
        }
      }
    } catch {
      /* */
    }
  })

  ctx.on('llm/stream', (options, next) => {
    const purpose = options?.purpose
    if (purpose === 'compaction' || purpose === 'session-title') return next()
    const hint = takeHint()
    const inner = next()
    if (!hint) return inner
    return (async function* () {
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      yield { type: 'reasoning-delta', index: 0, text: hint }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: hint } }
      for await (const chunk of inner) {
        if (chunk && typeof chunk === 'object' && typeof chunk.index === 'number') {
          yield { ...chunk, index: chunk.index + 1 }
        } else {
          yield chunk
        }
      }
    })()
  }, { global: true })
}

/** @type {string|null} */
let pendingHint = null
function pushHint(s) {
  pendingHint = s
}
function takeHint() {
  const h = pendingHint
  pendingHint = null
  return h
}

export default { name, inject, apply }
