import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readRunState, writeRunState, clearRunState, listStacks, summarizeStacks, stackIsActive } from '../src/runstate.js'

test('runstate roundtrip', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-run-'))
  const prev = process.env.DEEP_HOME
  process.env.DEEP_HOME = home
  try {
    writeRunState('teststack', { stack: 'teststack', warming: true })
    const s = readRunState('teststack')
    assert.equal(s.stack, 'teststack')
    assert.equal(s.warming, true)
    clearRunState('teststack')
    assert.equal(readRunState('teststack'), null)
    fs.mkdirSync(path.join(home, 'run', 'a'), { recursive: true })
    fs.mkdirSync(path.join(home, 'run', 'b'), { recursive: true })
    const stacks = listStacks()
    assert.ok(stacks.includes('a') && stacks.includes('b'))

    writeRunState('a', { stack: 'a', pids: { llama: 1 }, guestRunning: true })
    assert.equal(stackIsActive('a'), true)
    const summary = summarizeStacks()
    assert.ok(summary.some((s) => s.name === 'a' && s.active))
  } finally {
    if (prev === undefined) delete process.env.DEEP_HOME
    else process.env.DEEP_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
