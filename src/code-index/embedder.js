/**
 * Simple TF-IDF-ish bag hash vector (stdlib fallback) + optional llama /v1/embeddings.
 */
export const EMBED_DIM = 256
const DIM = EMBED_DIM

/** @type {Map<string, boolean>} */
const embedProbeCache = new Map()

/**
 * @param {string} text
 * @returns {Float32Array}
 */
export function hashEmbed(text) {
  const vec = new Float32Array(DIM)
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^\w\s$]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  for (const tok of tokens) {
    let h = 2166136261
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i)
    }
    h = Math.imul(h, 16777619)
    const idx = Math.abs(h) % DIM
    vec[idx] += 1
  }
  return normalize(vec)
}

/**
 * @param {Float32Array} a
 * @param {Float32Array} b
 */
export function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * @param {Float32Array} v
 */
function normalize(v) {
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  n = Math.sqrt(n) || 1
  for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

/** GIM_INDEX_EMBED=hash|llama|auto (default auto). */
export function embedMode() {
  const m = String(process.env.GIM_INDEX_EMBED || 'auto').toLowerCase()
  if (m === 'hash' || m === '0') return 'hash'
  if (m === 'llama' || m === '1') return 'llama'
  return 'auto'
}

/**
 * @param {string} llamaBase
 */
export async function probeLlamaEmbeddings(llamaBase) {
  const base = String(llamaBase || '').replace(/\/$/, '')
  if (!base) return false
  if (embedProbeCache.has(base)) return embedProbeCache.get(base)
  try {
    const r = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'coder', input: 'ping' }),
      signal: AbortSignal.timeout(4000),
    })
    const ok = r.ok
    embedProbeCache.set(base, ok)
    return ok
  } catch {
    embedProbeCache.set(base, false)
    return false
  }
}

/** @internal */
export function clearEmbedProbeCacheForTests() {
  embedProbeCache.clear()
}

/**
 * Try llama.cpp / OpenAI-compatible /v1/embeddings; fall back to hashEmbed.
 * @param {string} text
 * @param {string} [llamaBase] e.g. http://127.0.0.1:18000/v1
 * @returns {Promise<Float32Array>}
 */
export async function embed(text, llamaBase) {
  const { vector } = await embedWithBackend(text, llamaBase)
  return vector
}

/**
 * @param {string} text
 * @param {string} [llamaBase]
 * @returns {Promise<{ vector: Float32Array, backend: 'hash'|'llama' }>}
 */
export async function embedWithBackend(text, llamaBase) {
  const mode = embedMode()
  if (mode === 'hash' || !llamaBase) {
    return { vector: hashEmbed(text), backend: 'hash' }
  }

  const base = llamaBase.replace(/\/$/, '')
  if (mode === 'auto') {
    const ok = await probeLlamaEmbeddings(base)
    if (!ok) return { vector: hashEmbed(text), backend: 'hash' }
  }

  try {
    const r = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'coder', input: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(15000),
    })
    if (r.ok) {
      const j = await r.json()
      const arr = j.data?.[0]?.embedding
      if (Array.isArray(arr) && arr.length) {
        embedProbeCache.set(base, true)
        return { vector: normalize(new Float32Array(arr)), backend: 'llama' }
      }
    }
    embedProbeCache.set(base, false)
  } catch {
    embedProbeCache.set(base, false)
  }
  return { vector: hashEmbed(text), backend: 'hash' }
}

/** @param {Float32Array} vec */
export function vecToArray(vec) {
  return Array.from(vec)
}

/** @param {number[]} arr */
export function arrayToVec(arr) {
  return normalize(new Float32Array(arr))
}
