import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { listSourceFiles, chunkWithTreeSitter } from './chunker.js'
import { embed, vecToArray } from './embedder.js'
import {
  indexPaths,
  loadIndexMeta,
  loadJsonChunks,
  loadFileMap,
  saveFileMap,
  saveJsonStore,
  saveIndexMeta,
  loadAllChunks,
  saveFileShard,
  loadFileShard,
  removeFileShard,
  shardsEnabled,
  searchJsonAsync,
  syncLanceStore,
  tryOpenLance,
  scheduleChunksSnapshot,
} from './store.js'
import { resolveIndexUrl, tryIndexHttpSearch, indexHttpBuild, indexHttpStatus } from './client.js'

/**
 * @param {string} workspaceRoot absolute host workspace
 * @param {string} indexDir
 */
export function defaultIndexDir(workspaceRoot) {
  return path.join(workspaceRoot, '.gim', 'code-index')
}

/**
 * @param {string} content
 */
export function fileContentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * @param {string} rel
 * @param {string} text
 * @param {import('node:fs').Stats} stat
 * @param {{ llamaBase?: string, useTreeSitter?: boolean }} opts
 * @returns {Promise<import('./store.js').StoredChunk[]>}
 */
async function chunksForFile(rel, text, stat, opts) {
  const parts =
    opts.useTreeSitter !== false
      ? await chunkWithTreeSitter(rel, text)
      : (await import('./chunker.js')).chunkSource(rel, text)
  /** @type {import('./store.js').StoredChunk[]} */
  const out = []
  for (const part of parts) {
    const body = `${part.path} ${part.symbol} ${part.kind}\n${part.text}`
    const vector = await embed(body, opts.llamaBase)
    out.push({
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
  return out
}

/**
 * Build or refresh code index (incremental when files.json present).
 * @param {{ workspaceRoot: string, indexDir?: string, llamaBase?: string, useTreeSitter?: boolean, maxFiles?: number, force?: boolean, onProgress?: (msg: string) => void }} opts
 */
export async function buildIndex(opts) {
  const workspaceRoot = path.resolve(opts.workspaceRoot)
  const indexDir = opts.indexDir || defaultIndexDir(workspaceRoot)
  const force = opts.force === true || process.env.GIM_INDEX_FULL === '1'
  const files = listSourceFiles(workspaceRoot, { maxFiles: opts.maxFiles })
  const paths = indexPaths(indexDir)
  const meta0 = loadIndexMeta(indexDir)
  const useShards = (meta0.sharded || shardsEnabled()) && shardsEnabled()

  /** @type {import('./store.js').StoredChunk[]|null} */
  let existingChunks = null
  let fileMap = {}
  if (!force) {
    fileMap = loadFileMap(indexDir)
  }

  /** @type {import('./store.js').StoredChunk[]} */
  const chunks = []
  /** @type {Record<string, { hash: string, mtime: number }>} */
  const nextFileMap = {}
  /** @type {Set<string>} */
  const diskPaths = new Set()
  let skippedFiles = 0
  let indexedFiles = 0
  let backend = meta0.backend || 'json'

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

    diskPaths.add(rel)
    const text = fs.readFileSync(abs, 'utf8')
    const hash = fileContentHash(text)

    if (!force && fileMap[rel]?.hash === hash) {
      if (useShards) {
        chunks.push(...loadFileShard(indexDir, rel))
      } else {
        if (!existingChunks) existingChunks = loadJsonChunks(indexDir)
        chunks.push(...existingChunks.filter((c) => c.path === rel))
      }
      nextFileMap[rel] = { hash, mtime: stat.mtimeMs }
      skippedFiles++
      if (opts.onProgress && i % 25 === 0) opts.onProgress(`${i + 1}/${files.length} ${rel} (skip)`)
      continue
    }

    const fileChunks = await chunksForFile(rel, text, stat, opts)
    chunks.push(...fileChunks)
    nextFileMap[rel] = { hash, mtime: stat.mtimeMs }
    indexedFiles++
    if (opts.onProgress && i % 25 === 0) opts.onProgress(`${i + 1}/${files.length} ${rel}`)
  }

  if (lance) {
    const synced = await syncLanceStore(indexDir, chunks)
    if (!synced.ok) backend = 'json'
  }

  saveJsonStore(indexDir, chunks, {
    backend,
    fileCount: diskPaths.size,
    skippedFiles,
    indexedFiles,
    incremental: !force && skippedFiles > 0,
    fileMap: nextFileMap,
    sharded: shardsEnabled(),
  })
  saveFileMap(indexDir, nextFileMap)

  return {
    ok: true,
    backend,
    fileCount: diskPaths.size,
    chunkCount: chunks.length,
    skippedFiles,
    indexedFiles,
    incremental: !force && skippedFiles > 0,
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
  const stack = opts.stack || 'default'

  if (!opts.localOnly) {
    const httpHit = await tryIndexHttpSearch(stack, opts.query, limit)
    if (httpHit) return httpHit
  }

  const meta = loadIndexMeta(indexDir)
  const chunkCount = meta.chunkCount ?? 0
  if (!chunkCount) {
    return { ok: false, error: 'index empty — run: gim index build', hits: [] }
  }

  const queryVec = await embed(opts.query, opts.llamaBase)
  const chunks = loadAllChunks(indexDir)
  if (!chunks.length) {
    return { ok: false, error: 'index empty — run: gim index build', hits: [] }
  }

  const lance = await tryOpenLance(indexDir)
  if (lance && meta.backend === 'lancedb') {
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

  const hits = await searchJsonAsync(chunks, queryVec, limit)
  return {
    ok: true,
    backend: meta.backend || 'json',
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
 * Build via sidecar HTTP when stack index URL is live.
 * @param {string} stack
 */
export async function buildIndexViaHttp(stack = 'default') {
  const base = resolveIndexUrl(stack)
  if (!base) return { ok: false, error: 'index sidecar not running' }
  return indexHttpBuild(base)
}

/**
 * Status via sidecar HTTP when available.
 * @param {string} stack
 */
export async function indexStatusViaHttp(stack = 'default') {
  const base = resolveIndexUrl(stack)
  if (!base) return null
  const r = await indexHttpStatus(base)
  return r.ok ? r : null
}

/**
 * Lazy status — reads meta.json only, not chunks.json.
 * @param {string} indexDir
 */
export function indexStatus(indexDir) {
  const meta = loadIndexMeta(indexDir)
  const fileMap = loadFileMap(indexDir)
  return {
    backend: meta.backend || 'json',
    builtAt: meta.builtAt || null,
    chunkCount: meta.chunkCount ?? 0,
    fileCount: meta.fileCount ?? Object.keys(fileMap).length,
    skippedFiles: meta.skippedFiles ?? 0,
    indexedFiles: meta.indexedFiles ?? 0,
    incremental: meta.incremental ?? false,
    sharded: meta.sharded ?? false,
    indexDir,
  }
}

/** Incremental: re-index one file after write. */
export async function indexFile(workspaceRoot, relPath, llamaBase) {
  const indexDir = defaultIndexDir(workspaceRoot)
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.meta) && !fs.existsSync(p.json)) {
    return { ok: false, skipped: true, reason: 'index not built' }
  }

  const norm = relPath.replace(/\\/g, '/')
  const abs = path.join(workspaceRoot, relPath)
  const fileMap = loadFileMap(indexDir)
  const meta = loadIndexMeta(indexDir)
  const useShards = (meta.sharded || shardsEnabled()) && shardsEnabled()

  if (!fs.existsSync(abs)) {
    const prevCount = useShards ? loadFileShard(indexDir, norm).length : 0
    if (useShards) {
      removeFileShard(indexDir, norm)
    } else {
      const filtered = loadJsonChunks(indexDir).filter((c) => c.path !== norm)
      saveJsonStore(indexDir, filtered, {
        backend: meta.backend || 'json',
        fileCount: Object.keys(fileMap).length,
        sharded: false,
      })
    }
    delete fileMap[norm]
    saveFileMap(indexDir, fileMap)
    saveIndexMeta(indexDir, {
      backend: meta.backend || 'json',
      fileCount: Object.keys(fileMap).length,
      chunkCount: Math.max(0, (meta.chunkCount ?? 0) - prevCount),
      sharded: useShards,
      chunksStale: useShards,
    })
    if (useShards) scheduleChunksSnapshot(indexDir)
    return { ok: true, removed: true, path: norm }
  }

  const text = fs.readFileSync(abs, 'utf8')
  const hash = fileContentHash(text)
  if (fileMap[norm]?.hash === hash) {
    return { ok: true, skipped: true, reason: 'unchanged', path: norm }
  }

  const stat = fs.statSync(abs)
  const fileChunks = await chunksForFile(norm, text, stat, { llamaBase, useTreeSitter: true })

  if (useShards) {
    const prevCount = loadFileShard(indexDir, norm).length
    saveFileShard(indexDir, norm, fileChunks)
    fileMap[norm] = { hash, mtime: stat.mtimeMs }
    saveFileMap(indexDir, fileMap)
    saveIndexMeta(indexDir, {
      backend: meta.backend || 'json',
      fileCount: Object.keys(fileMap).length,
      chunkCount: Math.max(0, (meta.chunkCount ?? 0) - prevCount + fileChunks.length),
      indexedFiles: 1,
      sharded: true,
      chunksStale: true,
    })
    if (meta.backend === 'lancedb') {
      await syncLanceStore(indexDir, loadAllChunks(indexDir))
    }
    scheduleChunksSnapshot(indexDir)
    return { ok: true, path: norm, chunks: fileChunks.length, sharded: true }
  }

  const filtered = loadJsonChunks(indexDir).filter((c) => c.path !== norm)
  const merged = [...filtered, ...fileChunks]
  fileMap[norm] = { hash, mtime: stat.mtimeMs }

  saveJsonStore(indexDir, merged, {
    backend: meta.backend || 'json',
    fileCount: Object.keys(fileMap).length,
    indexedFiles: 1,
    fileMap,
    sharded: false,
  })
  saveFileMap(indexDir, fileMap)
  if (meta.backend === 'lancedb') {
    await syncLanceStore(indexDir, merged)
  }
  return { ok: true, path: norm, chunks: fileChunks.length }
}
