import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
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
    shards: path.join(indexDir, 'shards'),
  }
}

export function shardsEnabled() {
  return process.env.GIM_INDEX_SHARDS !== '0'
}

/**
 * @param {string} relPath
 */
export function shardKeyForPath(relPath) {
  return String(relPath)
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._/-]+/g, '_')
    .slice(0, 220)
}

/**
 * @param {string} indexDir
 * @param {string} relPath
 */
export function shardPathForFile(indexDir, relPath) {
  const key = shardKeyForPath(relPath)
  return path.join(indexPaths(indexDir).shards, `${key.replace(/\//g, '__')}.json`)
}

/**
 * @param {string} indexDir
 * @param {string} relPath
 * @param {StoredChunk[]} chunks
 */
export function saveFileShard(indexDir, relPath, chunks) {
  const p = shardPathForFile(indexDir, relPath)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({ path: relPath, chunks }, null, 0), 'utf8')
}

/**
 * @param {string} indexDir
 * @param {string} relPath
 */
export function loadFileShard(indexDir, relPath) {
  const p = shardPathForFile(indexDir, relPath)
  if (!fs.existsSync(p)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    return raw.chunks || []
  } catch {
    return []
  }
}

/**
 * @param {string} indexDir
 * @param {string} relPath
 */
export function removeFileShard(indexDir, relPath) {
  const p = shardPathForFile(indexDir, relPath)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

/**
 * Load all chunks — shards (fast touch path) or monolithic chunks.json.
 * @param {string} indexDir
 */
export function loadAllChunks(indexDir) {
  const meta = loadIndexMeta(indexDir)
  if (meta.sharded && shardsEnabled()) {
    const fileMap = loadFileMap(indexDir)
    /** @type {StoredChunk[]} */
    const out = []
    for (const rel of Object.keys(fileMap)) {
      out.push(...loadFileShard(indexDir, rel))
    }
    if (out.length) return out
  }
  return loadJsonChunks(indexDir)
}

/** @type {Map<string, NodeJS.Timeout>} */
const snapshotTimers = new Map()

/**
 * Debounced rewrite of chunks.json from shards (keeps monolithic snapshot fresh without blocking touch).
 * @param {string} indexDir
 */
export function scheduleChunksSnapshot(indexDir) {
  if (process.env.GIM_INDEX_SNAPSHOT === '0') return
  const ms = Number(process.env.GIM_INDEX_SNAPSHOT_MS) || 3000
  const prev = snapshotTimers.get(indexDir)
  if (prev) clearTimeout(prev)
  snapshotTimers.set(
    indexDir,
    setTimeout(() => {
      snapshotTimers.delete(indexDir)
      try {
        flushChunksSnapshot(indexDir)
      } catch {
        /* */
      }
    }, ms),
  )
}

/**
 * @param {string} indexDir
 */
export function flushChunksSnapshot(indexDir) {
  const meta = loadIndexMeta(indexDir)
  if (!meta.sharded) return { ok: false, reason: 'not sharded' }
  const chunks = loadAllChunks(indexDir)
  const p = indexPaths(indexDir)
  fs.mkdirSync(indexDir, { recursive: true })
  fs.writeFileSync(p.json, JSON.stringify({ chunks }, null, 0), 'utf8')
  saveIndexMeta(indexDir, {
    backend: meta.backend || 'json',
    fileCount: meta.fileCount ?? 0,
    chunkCount: chunks.length,
    sharded: true,
    chunksStale: false,
  })
  return { ok: true, chunkCount: chunks.length }
}

/** @internal */
export function flushChunksSnapshotTimersForTests() {
  for (const [dir, t] of snapshotTimers) {
    clearTimeout(t)
    snapshotTimers.delete(dir)
    try {
      flushChunksSnapshot(dir)
    } catch {
      /* */
    }
  }
}

/**
 * Write per-file shards + optional monolithic snapshot.
 * @param {string} indexDir
 * @param {StoredChunk[]} chunks
 * @param {Record<string, import('./store.js').FileIndexEntry>} fileMap
 */
export function saveShardedStore(indexDir, chunks, fileMap) {
  const p = indexPaths(indexDir)
  fs.mkdirSync(p.shards, { recursive: true })
  /** @type {Record<string, StoredChunk[]>} */
  const byPath = {}
  for (const c of chunks) {
    if (!byPath[c.path]) byPath[c.path] = []
    byPath[c.path].push(c)
  }
  for (const rel of Object.keys(fileMap)) {
    saveFileShard(indexDir, rel, byPath[rel] || [])
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
  const sharded = meta.sharded ?? (shardsEnabled() && (meta.fileCount ?? 0) > 0)
  if (sharded) {
    const fileMap = meta.fileMap || loadFileMap(indexDir)
    saveShardedStore(indexDir, chunks, fileMap)
  }
  fs.writeFileSync(p.json, JSON.stringify({ chunks }, null, 0), 'utf8')
  saveIndexMeta(indexDir, {
    backend: meta.backend || 'json',
    fileCount: meta.fileCount ?? 0,
    chunkCount: chunks.length,
    skippedFiles: meta.skippedFiles ?? 0,
    indexedFiles: meta.indexedFiles ?? 0,
    incremental: meta.incremental ?? false,
    sharded,
  })
}

/**
 * @param {string} indexDir
 * @param {object} patch
 */
export function saveIndexMeta(indexDir, patch) {
  const prev = loadIndexMeta(indexDir)
  fs.mkdirSync(indexDir, { recursive: true })
  fs.writeFileSync(
    indexPaths(indexDir).meta,
    JSON.stringify(
      {
        ...prev,
        ...patch,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  )
}

/** LanceDB: auto when optional deps installed; GIM_INDEX_LANCE=0 disables, =1 forces try. */
export function lanceEnabled() {
  const v = process.env.GIM_INDEX_LANCE
  if (v === '0') return false
  return true
}

/** @returns {Promise<{ available: boolean, reason?: string }>} */
export async function assessLanceBackend() {
  if (!lanceEnabled()) return { available: false, reason: 'GIM_INDEX_LANCE=0' }
  try {
    const optionalRoot = new URL('../../../optional/code-index/node_modules/', import.meta.url)
    await import(new URL('@lancedb/lancedb', optionalRoot).href)
    return { available: true }
  } catch {
    return {
      available: false,
      reason: 'optional deps missing — cd optional/code-index && npm install',
    }
  }
}

/** Try LanceDB when optional deps installed. */
export async function tryOpenLance(indexDir) {
  if (!lanceEnabled()) return null
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
 * Rebuild Lance table from all chunks (after incremental touch).
 * @param {{ db: object }} lance
 * @param {StoredChunk[]} chunks
 */
export async function rebuildLanceTable(lance, chunks) {
  const tableName = 'code_chunks'
  const rows = chunks.map((c) => ({ ...c, vector: c.vector }))
  const tables = await lance.db.tableNames()
  if (tables.includes(tableName)) {
    await lance.db.dropTable(tableName)
  }
  if (rows.length) {
    await lance.db.createTable(tableName, rows)
  }
}

/**
 * @param {string} indexDir
 * @param {StoredChunk[]} chunks
 */
export async function syncLanceStore(indexDir, chunks) {
  const lance = await tryOpenLance(indexDir)
  if (!lance) return { ok: false, reason: 'lance unavailable' }
  try {
    await rebuildLanceTable(lance, chunks)
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e.message || e) }
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
