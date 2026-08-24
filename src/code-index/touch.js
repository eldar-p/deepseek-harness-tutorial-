/**
 * Debounced incremental index touch after agent writes (background, non-blocking).
 */
import fs from 'node:fs'
import { paths } from '../paths.js'
import { readRunState } from '../runstate.js'
import { defaultIndexDir } from './indexer.js'
import { indexPaths, loadIndexMeta } from './store.js'

const DEBOUNCE_MS = Number(process.env.GIM_INDEX_TOUCH_MS) || 1500

/** @type {Map<string, NodeJS.Timeout>} */
const pending = new Map()

export function indexTouchEnabled() {
  return process.env.GIM_INDEX_TOUCH !== '0'
}

/**
 * @param {string} stack
 * @param {string} relPath
 */
export function scheduleIndexTouch(stack, relPath) {
  if (!indexTouchEnabled()) return
  const norm = String(relPath || '').replace(/\\/g, '/')
  if (!norm || norm.startsWith('.gim/')) return

  const workspace = paths(stack).workspace
  const indexDir = defaultIndexDir(workspace)
  const meta = loadIndexMeta(indexDir)
  if (!meta.builtAt && !meta.chunkCount) return

  const key = `${stack}:${norm}`
  const prev = pending.get(key)
  if (prev) clearTimeout(prev)

  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      void touchIndexFile(stack, norm).catch(() => {})
    }, DEBOUNCE_MS),
  )
}

/**
 * @param {string} stack
 * @param {string} relPath
 */
export async function touchIndexFile(stack, relPath) {
  const workspace = paths(stack).workspace
  const indexDir = defaultIndexDir(workspace)
  const p = indexPaths(indexDir)
  if (!fs.existsSync(p.meta) && !fs.existsSync(p.json)) {
    return { ok: false, skipped: true, reason: 'index not built' }
  }
  const run = readRunState(stack)
  const { indexFile } = await import('./indexer.js')
  return indexFile(workspace, relPath, run?.urls?.llama)
}

/** @internal test helper */
export function flushIndexTouchForTests() {
  for (const [key, timer] of pending) {
    clearTimeout(timer)
    pending.delete(key)
  }
}
