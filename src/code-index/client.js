/**
 * Code index HTTP client — talks to sidecar (JS or native) when stack is running.
 */
import { readRunState } from '../runstate.js'

/**
 * @param {string} [stack]
 */
export function resolveIndexUrl(stack = 'default') {
  const fromEnv = process.env.GIM_INDEX_URL
  if (fromEnv) return String(fromEnv).replace(/\/$/, '')
  const run = readRunState(stack)
  const u = run?.urls?.index
  return u ? String(u).replace(/\/$/, '') : null
}

/**
 * @param {string} baseUrl
 */
export async function indexHttpStatus(baseUrl) {
  const r = await fetch(`${baseUrl}/status`)
  if (!r.ok) return { ok: false, error: `status ${r.status}` }
  return { ok: true, ...(await r.json()) }
}

/**
 * @param {string} baseUrl
 * @param {string} query
 * @param {number} [limit]
 */
export async function indexHttpSearch(baseUrl, query, limit = 8) {
  const r = await fetch(`${baseUrl}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  const j = await r.json()
  if (!r.ok) return { ok: false, error: j.error || r.statusText, hits: [] }
  return {
    ok: j.ok !== false,
    backend: j.backend || 'http',
    hits: (j.hits || []).map(formatHttpHit),
    error: j.error,
  }
}

/**
 * @param {string} baseUrl
 */
export async function indexHttpBuild(baseUrl) {
  const r = await fetch(`${baseUrl}/build`, { method: 'POST' })
  const j = await r.json()
  return { ok: r.ok && j.ok !== false, ...j }
}

/**
 * @param {string} baseUrl
 * @param {string} relPath
 */
export async function indexHttpTouch(baseUrl, relPath) {
  const r = await fetch(`${baseUrl}/touch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: relPath }),
  })
  return { ok: r.ok, ...(await r.json()) }
}

/** @param {object} h */
function formatHttpHit(h) {
  return {
    path: h.path,
    symbol: h.symbol,
    kind: h.kind,
    startLine: h.startLine,
    endLine: h.endLine,
    score: h.score,
    preview: String(h.preview || h.text || '').slice(0, 400),
  }
}

/**
 * Prefer sidecar HTTP when URL is live; else null.
 * @param {string} stack
 */
export async function tryIndexHttpSearch(stack, query, limit = 8) {
  const base = resolveIndexUrl(stack)
  if (!base) return null
  try {
    const st = await indexHttpStatus(base)
    if (!st.ok) return null
    const r = await indexHttpSearch(base, query, limit)
    return r.ok ? r : null
  } catch {
    return null
  }
}
