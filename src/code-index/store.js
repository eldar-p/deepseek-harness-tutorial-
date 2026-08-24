import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { cosine, arrayToVec, EMBED_DIM } from './embedder.js'

/** @typedef {{ id: string, path: string, symbol: string, kind: string, startLine: number, endLine: number, text: string, lang: string, vector: number[], mtime: number }} StoredChunk */
/** @typedef {{ hash: string, mtime?: number }} FileIndexEntry */

const WORKER_SCRIPT = fileURLToPath(new URL('./search-worker.js', import.meta.url))
const WORKER_MIN_CHUNKS = Number(process.env.GIM_INDEX_WORKER_MIN) || 500

/**
 * @param {string} indexDir ~/.gim/workspace/<stack>/.gim/code-index
 */
export function indexPaths(indexDir) {
  return {
    root: indexDir,
    json: path.join(indexDir, 'chunks.json'),
    meta: path.join(indexDir, 'meta.json'),
    files: path.join(indexDir, 'files.json'),
    lance: path.join(indexDir, 'lance'),
  }
}

/**
 * Meta only — no chunks.json parse (lazy index).
 * @param {string} indexDir
 */
export function loadIndexMeta(indexDir) {
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.meta)) {
    return { backend: 'json', builtAt: null, chunkCount: 0, fileCount: 0 }
  }
  return JSON.parse(fs.readFileSync(p.meta, 'utf8'))
}

/**
 * @param {string} indexDir
 * @returns {StoredChunk[]}
 */
export function loadJsonChunks(indexDir) {
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.json)) return []
  const raw = JSON.parse(fs.readFileSync(p.json, 'utf8'))
  return raw.chunks || []
}

/**
 * @param {string} indexDir
 * @returns {Record<string, FileIndexEntry>}
 */
export function loadFileMap(indexDir) {
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.files)) return {}
  try {
    return JSON.parse(fs.readFileSync(p.files, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * @param {string} indexDir
 * @param {Record<string, FileIndexEntry>} map
 */
export function saveFileMap(indexDir, map) {
  fs.mkdirSync(indexDir, { recursive: true })
  fs.writeFileSync(indexPaths(indexDir).files, JSON.stringify(map, null, 0), 'utf8')
}

/**
 * @param {string} indexDir
 * @returns {{ chunks: StoredChunk[], backend: string, builtAt: string|null }}
 */
export function loadJsonStore(indexDir) {
  const meta = loadIndexMeta(indexDir)
  return {
    chunks: loadJsonChunks(indexDir),
    backend: meta.backend || 'json',
    builtAt: meta.builtAt || null,
  }
}

/**
 * @param {string} indexDir
 * @param {StoredChunk[]} chunks
 * @param {{ backend?: string, fileCount?: number, skippedFiles?: number, indexedFiles?: number, incremental?: boolean }} meta
 */
export function saveJsonStore(indexDir, chunks, meta = {}) {
  fs.mkdirSync(indexDir, { recursive: true })
  const p = indexPaths(indexDir)
  fs.writeFileSync(p.json, JSON.stringify({ chunks }, null, 0), 'utf8')
  fs.writeFileSync(
    p.meta,
    JSON.stringify(
      {
        backend: meta.backend || 'json',
        builtAt: new Date().toISOString(),
        fileCount: meta.fileCount ?? 0,
        chunkCount: chunks.length,
        skippedFiles: meta.skippedFiles ?? 0,
        indexedFiles: meta.indexedFiles ?? 0,
        incremental: meta.incremental ?? false,
      },
      null,
      2,
    ),
    'utf8',
  )
}

/** Try LanceDB when optional deps installed. */
export async function tryOpenLance(indexDir) {
  try {
    const optionalRoot = new URL('../../../optional/code-index/node_modules/', import.meta.url)
    const lancedb = await import(new URL('@lancedb/lancedb', optionalRoot).href)
    const p = indexPaths(indexDir)
    fs.mkdirSync(p.root, { recursive: true })
    const db = await lancedb.connect(p.lance)
    return { db, lancedb, lancePath: p.lance }
  } catch {
    return null
  }
}

/**
 * @param {StoredChunk[]} chunks
 * @param {Float32Array} queryVec
 * @param {number} limit
 */
export function searchJson(chunks, queryVec, limit = 8) {
  const scored = chunks.map((c) => ({
    chunk: c,
    score: cosine(queryVec, arrayToVec(c.vector)),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).filter((x) => x.score > 0.01)
}

/**
 * @param {StoredChunk[]} chunks
 * @param {Float32Array} matrix
 * @param {number} count
 * @param {number} dim
 */
function searchJsonWithMatrix(chunks, queryVec, matrix, count, dim, limit) {
  /** @type {{ chunk: StoredChunk, score: number }[]} */
  const scored = []
  for (let row = 0; row < count; row++) {
    const off = row * dim
    let dot = 0
    let nb = 0
    for (let j = 0; j < dim; j++) {
      const v = matrix[off + j]
      dot += queryVec[j] * v
      nb += v * v
    }
    let na = 0
    for (let j = 0; j < dim; j++) na += queryVec[j] * queryVec[j]
    const score = na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
    if (score > 0.01) scored.push({ chunk: chunks[row], score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/**
 * @param {StoredChunk[]} chunks
 * @param {Float32Array} queryVec
 * @param {number} limit
 * @returns {Promise<{ chunk: StoredChunk, score: number }[]>}
 */
export function searchJsonAsync(chunks, queryVec, limit = 8) {
  if (chunks.length < WORKER_MIN_CHUNKS) {
    return Promise.resolve(searchJson(chunks, queryVec, limit))
  }

  const dim = chunks[0]?.vector?.length || EMBED_DIM
  const count = chunks.length
  const matrix = new Float32Array(count * dim)
  for (let i = 0; i < count; i++) {
    const vec = arrayToVec(chunks[i].vector)
    matrix.set(vec, i * dim)
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (rows) => {
      if (settled) return
      settled = true
      resolve(rows)
    }

    const worker = new Worker(WORKER_SCRIPT, {
      workerData: {
        queryVec,
        matrix,
        count,
        dim,
        limit,
        minScore: 0.01,
      },
      transferList: [matrix.buffer],
    })
    worker.on('message', (rows) => {
      finish(
        rows.map(({ i, score }) => ({
          chunk: chunks[i],
          score,
        })),
      )
    })
    worker.on('error', () => {
      finish(searchJson(chunks, queryVec, limit))
    })
    worker.on('exit', () => {
      if (!settled) {
        finish(searchJson(chunks, queryVec, limit))
      }
    })
  })
}
