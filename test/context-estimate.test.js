import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { estimateContextUsage } from '../src/context-estimate.js'
import { initAiInstructions } from '../src/instructions.js'

test('estimateContextUsage counts ai-instructions in rules bucket', () => {
  const prev = process.env.GIM_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ctx-'))
  process.env.GIM_HOME = home
  const stack = 'ctx-est'
  try {
    initAiInstructions(stack)
    const usage = estimateContextUsage({ mode: 'agent', stack })
    const rules = usage.buckets.find((b) => b.id === 'rules')
    assert.ok(rules)
    assert.ok(rules.tokens > 0)
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})
