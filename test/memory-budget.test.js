import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  checkFileBudget,
  assessMemoryJson,
  assessWorkspaceMemoryBudget,
  MEMORY_MAX_BYTES,
  MEMORY_MAX_FACTS,
} from '../src/memory-budget.js'

test('checkFileBudget ok and over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-mem-'))
  const f = path.join(dir, 'CONTEXT.md')
  fs.writeFileSync(f, 'x'.repeat(100))
  assert.equal(checkFileBudget(f, 200).ok, true)
  assert.equal(checkFileBudget(f, 50).ok, false)
  assert.equal(checkFileBudget(path.join(dir, 'missing.md'), 10).ok, true)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('assessMemoryJson caps facts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-memj-'))
  const mem = path.join(dir, 'memory.json')
  fs.writeFileSync(
    mem,
    JSON.stringify({
      version: 1,
      facts: Array.from({ length: MEMORY_MAX_FACTS + 2 }, (_, i) => `f${i}`),
      recentChanges: [],
    }),
  )
  const r = assessMemoryJson(mem)
  assert.equal(r.ok, false)
  assert.ok(r.warns.some((w) => /facts/.test(w)))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('assessWorkspaceMemoryBudget', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ws-mem-'))
  const gim = path.join(dir, '.gim')
  fs.mkdirSync(gim)
  const memory = path.join(gim, 'memory.json')
  fs.writeFileSync(memory, JSON.stringify({ version: 1, facts: [], recentChanges: [] }))
  fs.writeFileSync(path.join(gim, 'CONTEXT.md'), '# ok\n')
  const r = assessWorkspaceMemoryBudget({ workspace: dir, memory })
  assert.equal(r.ok, true)
  fs.writeFileSync(path.join(gim, 'CONTEXT.md'), 'y'.repeat(MEMORY_MAX_BYTES))
  const over = assessWorkspaceMemoryBudget({ workspace: dir, memory })
  // CONTEXT cap is 20KiB; writing MEMORY_MAX_BYTES (25KiB) exceeds it
  assert.equal(over.ok, false)
  fs.rmSync(dir, { recursive: true, force: true })
})
