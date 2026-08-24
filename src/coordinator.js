/**
 * Host-side coordinator: split a task into parallel index-search workers.
 */
import { searchIndex, defaultIndexDir } from './code-index/indexer.js'
import { paths } from './paths.js'
import { readRunState } from './runstate.js'

/**
 * @param {string} task
 * @param {{ stack?: string, limit?: number, maxWorkers?: number, searchFn?: typeof searchIndex }} [opts]
 */
export async function runCoordinator(task, opts = {}) {
  const stack = opts.stack || 'default'
  const maxWorkers = opts.maxWorkers ?? 4
  const limit = opts.limit ?? 5
  const searchFn = opts.searchFn || searchIndex

  const raw = String(task || '').trim()
  if (!raw) {
    throw Object.assign(new Error('Usage: gim coord --task="..." [--name STACK]'), { exitCode: 2 })
  }

  const subtasks = raw
    .split(/\s+and\s+|\s*;\s*|\n/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxWorkers)

  const ws = paths(stack).workspace
  const indexDir = defaultIndexDir(ws)
  const run = readRunState(stack)

  const results = await Promise.all(
    subtasks.map(async (q, i) => {
      const r = await searchFn({
        workspaceRoot: ws,
        indexDir,
        query: q,
        llamaBase: run?.urls?.llama,
        limit,
      })
      const hits = r.ok ? r.hits : []
      return {
        worker: i,
        query: q,
        ok: !!r.ok,
        hits: hits.map((h) => ({
          path: h.path,
          startLine: h.startLine,
          symbol: h.symbol,
          score: h.score,
        })),
      }
    }),
  )

  return { task: raw, stack, workers: subtasks.length, results }
}

export async function cmdCoord(flags = {}, args = []) {
  const task = flags.task || args.join(' ').trim()
  const out = await runCoordinator(task, {
    stack: flags.name || 'default',
    limit: Number(flags.limit || 5),
    maxWorkers: Number(flags.workers || 4),
  })
  console.log(JSON.stringify(out, null, 2))
  return out
}
