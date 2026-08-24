import fs from 'node:fs'
import path from 'node:path'
import { cosine, arrayToVec } from './embedder.js'

/** @typedef {{ id: string, path: string, symbol: string, kind: string, startLine: number, endLine: number, text: string, lang: string, vector: number[], mtime: number }} StoredChunk */

/**
 * @param {string} indexDir ~/.deep/workspace/<stack>/.deep/code-index
 */
export function indexPaths(indexDir) {
  return {
    root: indexDir,
    json: path.join(indexDir, 'chunks.json'),
    meta: path.join(indexDir, 'meta.json'),
    lance: path.join(indexDir, 'lance'),
  }
}

/**
 * @param {string} indexDir
 * @returns {{ chunks: StoredChunk[], backend: string, builtAt: string|null }}
 */
export function loadJsonStore(indexDir) {
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.json)) {
    return { chunks: [], backend: 'json', builtAt: null }
  }
  const raw = JSON.parse(fs.readFileSync(p.json, 'utf8'))
  const meta = fs.existsSync(p.meta) ? JSON.parse(fs.readFileSync(p.meta, 'utf8')) : {}
  return {
    chunks: raw.chunks || [],
    backend: meta.backend || 'json',
    builtAt: meta.builtAt || null,
  }
}

/**
 * @param {string} indexDir
 * @param {StoredChunk[]} chunks
 * @param {{ backend?: string, fileCount?: number }} meta
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
