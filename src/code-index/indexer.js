import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, chunkWithTreeSitter } from './chunker.js'
import { embed, vecToArray } from './embedder.js'
import { loadJsonStore, saveJsonStore, searchJson, tryOpenLance } from './store.js'

/**
 * @param {string} workspaceRoot absolute host workspace
 * @param {string} indexDir
 */
export function defaultIndexDir(workspaceRoot) {
  return path.join(workspaceRoot, '.gim', 'code-index')
}

/**
 * Build or refresh code index.
 * @param {{ workspaceRoot: string, indexDir?: string, llamaBase?: string, useTreeSitter?: boolean, maxFiles?: number, onProgress?: (msg: string) => void }} opts
 */
export async function buildIndex(opts) {
  const workspaceRoot = path.resolve(opts.workspaceRoot)
  const indexDir = opts.indexDir || defaultIndexDir(workspaceRoot)
  const files = listSourceFiles(workspaceRoot, { maxFiles: opts.maxFiles })
  /** @type {import('./store.js').StoredChunk[]} */
  const chunks = []
  let backend = 'json'

  const lance = await tryOpenLance(indexDir)
  if (lance) backend = 'lancedb'

  for (let i = 0; i < files.length; i++) {
    const abs = files[i]
    const rel = path.relative(workspaceRoot, abs).replace(/\\/g, '/')
    if (rel.startsWith('.gim/')) continue
    let stat
    try {
      stat = fs.statSync(abs)
    } catch {
      continue
    }
    if (!stat.isFile() || stat.size > 512 * 1024) continue
    const text = fs.readFileSync(abs, 'utf8')
    const parts = opts.useTreeSitter !== false
      ? await chunkWithTreeSitter(rel, text)
      : (await import('./chunker.js')).chunkSource(rel, text)
    for (const part of parts) {
      const body = `${part.path} ${part.symbol} ${part.kind}\n${part.text}`
      const vector = await embed(body, opts.llamaBase)
      chunks.push({
        id: `${part.path}:${part.startLine}:${part.symbol}`,
        path: part.path,
        symbol: part.symbol,
        kind: part.kind,
        startLine: part.startLine,
        endLine: part.endLine,
        text: part.text,
        lang: part.lang,
        vector: vecToArray(vector),
        mtime: stat.mtimeMs,
      })
    }
    if (opts.onProgress && i % 25 === 0) opts.onProgress(`${i + 1}/${files.length} ${rel}`)
  }

  if (lance) {
    const tableName = 'code_chunks'
    const rows = chunks.map((c) => ({ ...c, vector: c.vector }))
    try {
      const tables = await lance.db.tableNames()
      if (tables.includes(tableName)) {
        await lance.db.dropTable(tableName)
      }
      await lance.db.createTable(tableName, rows)
    } catch {
      backend = 'json'
    }
  }

  saveJsonStore(indexDir, chunks, { backend, fileCount: files.length })
  return {
    ok: true,
    backend,
    fileCount: files.length,
    chunkCount: chunks.length,
    indexDir,
  }
}

/**
 * Semantic search over index.
 * @param {{ workspaceRoot: string, indexDir?: string, query: string, llamaBase?: string, limit?: number }} opts
 */
export async function searchIndex(opts) {
  const workspaceRoot = path.resolve(opts.workspaceRoot)
  const indexDir = opts.indexDir || defaultIndexDir(workspaceRoot)
  const limit = opts.limit ?? 8
  const queryVec = await embed(opts.query, opts.llamaBase)
  const store = loadJsonStore(indexDir)
  if (!store.chunks.length) {
    return { ok: false, error: 'index empty — run: gim index build', hits: [] }
  }

  const lance = await tryOpenLance(indexDir)
  if (lance && store.backend === 'lancedb') {
    try {
      const tbl = await lance.db.openTable('code_chunks')
      const hits = await tbl.search(Array.from(queryVec)).limit(limit).toArray()
      return {
        ok: true,
        backend: 'lancedb',
        hits: hits.map((h) => formatHit(h)),
      }
    } catch {
      /* json fallback */
    }
  }

  const hits = searchJson(store.chunks, queryVec, limit)
  return {
    ok: true,
    backend: store.backend,
    hits: hits.map(({ chunk, score }) => formatHit({ ...chunk, _distance: 1 - score })),
  }
}

/** @param {object} h */
function formatHit(h) {
  return {
    path: h.path,
    symbol: h.symbol,
    kind: h.kind,
    startLine: h.startLine,
    endLine: h.endLine,
    score: h._distance != null ? Number((1 - h._distance).toFixed(4)) : h.score,
    preview: String(h.text || '').slice(0, 400),
  }
}

/**
 * @param {string} indexDir
 */
export function indexStatus(indexDir) {
  const store = loadJsonStore(indexDir)
  return {
    backend: store.backend,
    builtAt: store.builtAt,
    chunkCount: store.chunks.length,
    indexDir,
  }
}

/** Incremental: re-index one file after write. */
export async function indexFile(workspaceRoot, relPath, llamaBase) {
  const indexDir = defaultIndexDir(workspaceRoot)
  const abs = path.join(workspaceRoot, relPath)
  if (!fs.existsSync(abs)) return
  const store = loadJsonStore(indexDir)
  const filtered = store.chunks.filter((c) => c.path !== relPath.replace(/\\/g, '/'))
  const text = fs.readFileSync(abs, 'utf8')
  const parts = await chunkWithTreeSitter(relPath.replace(/\\/g, '/'), text)
  const stat = fs.statSync(abs)
  for (const part of parts) {
    const body = `${part.path} ${part.symbol} ${part.kind}\n${part.text}`
    const vector = await embed(body, llamaBase)
    filtered.push({
      id: `${part.path}:${part.startLine}:${part.symbol}`,
      path: part.path,
      symbol: part.symbol,
      kind: part.kind,
      startLine: part.startLine,
      endLine: part.endLine,
      text: part.text,
      lang: part.lang,
      vector: vecToArray(vector),
      mtime: stat.mtimeMs,
    })
  }
  saveJsonStore(indexDir, filtered, { backend: store.backend, fileCount: filtered.length })
}
