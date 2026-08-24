/** Simple TF-IDF-ish bag hash vector (stdlib fallback). */
export const EMBED_DIM = 256
const DIM = EMBED_DIM

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
      h = Math.imul(h, 16777619)
    }
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
  for (let i = 0; i < a.length; i++) {
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

/**
 * Try llama.cpp /v1/embeddings; fall back to hashEmbed.
 * @param {string} text
 * @param {string} [llamaBase] e.g. http://127.0.0.1:18000/v1
 */
export async function embed(text, llamaBase) {
  if (llamaBase) {
    try {
      const r = await fetch(`${llamaBase.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'coder', input: text.slice(0, 4000) }),
        signal: AbortSignal.timeout(15000),
      })
      if (r.ok) {
        const j = await r.json()
        const arr = j.data?.[0]?.embedding
        if (Array.isArray(arr) && arr.length) {
          return normalize(new Float32Array(arr))
        }
      }
    } catch {
      /* fallback */
    }
  }
  return hashEmbed(text)
}

/** @param {Float32Array} vec */
export function vecToArray(vec) {
  return Array.from(vec)
}

/** @param {number[]} arr */
export function arrayToVec(arr) {
  return normalize(new Float32Array(arr))
}
