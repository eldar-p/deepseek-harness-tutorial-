#!/usr/bin/env node
/**
 * Lightweight coordinator: split a coding task into parallel host-side workers.
 * Workers share only the index search + file read tools (clean context).
 *
 * Usage: node scripts/coordinator.mjs --stack=default --task="fix auth bug"
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRunState } from '../src/runstate.js'
import { searchIndex, defaultIndexDir } from '../src/code-index/indexer.js'
import { paths } from '../src/paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] || d
const stack = arg('stack', 'default')
const task = arg('task', '')
if (!task) {
  console.error('Usage: node scripts/coordinator.mjs --task="..." [--stack=default]')
  process.exit(2)
}

const ws = paths(stack).workspace
const indexDir = defaultIndexDir(ws)
const run = readRunState(stack)

const subtasks = task
  .split(/\s+and\s+|\s*;\s*|\n/i)
  .map((s) => s.trim())
  .filter(Boolean)
  .slice(0, 4)

console.log(`[coordinator] stack=${stack} workers=${subtasks.length}`)

const results = await Promise.all(
  subtasks.map(async (q, i) => {
    const r = await searchIndex({
      workspaceRoot: ws,
      indexDir,
      query: q,
      llamaBase: run?.urls?.llama,
      limit: 5,
    })
    const hits = r.ok ? r.hits : []
    console.log(`[worker ${i}] query=${JSON.stringify(q)} hits=${hits.length}`)
    return { query: q, hits: hits.map((h) => `${h.path}:${h.startLine} ${h.symbol}`) }
  }),
)

console.log(JSON.stringify({ task, results }, null, 2))
