import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  resolveCacheSlot,
  releaseCacheSlot,
  cacheSlotFromSeed,
  DEFAULT_KV_SLOTS,
} from '../src/llm-session.js'
import {
  compactToolResult,
  agentTemperature,
  textFallbackResponseFormat,
  stringifyToolResult,
} from '../src/agent-prefill.js'

test('resolveCacheSlot stable per chat', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-kv-'))
  const prev = process.env.GIM_HOME
  process.env.GIM_HOME = home
  try {
    const a = resolveCacheSlot('default', 'chat-abc', 8)
    const b = resolveCacheSlot('default', 'chat-abc', 8)
    assert.equal(a, b)
    assert.ok(a >= 1 && a < 8)
    releaseCacheSlot('default', 'chat-abc')
  } finally {
    if (prev === undefined) delete process.env.GIM_HOME
    else process.env.GIM_HOME = prev
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('cacheSlotFromSeed in range', () => {
  const s = cacheSlotFromSeed('eval-run-1')
  assert.ok(s >= 1 && s < DEFAULT_KV_SLOTS)
})

test('compactToolResult truncates long content', () => {
  const r = compactToolResult({ ok: true, content: 'x'.repeat(100_000) })
  assert.equal(r.truncated, true)
  assert.ok(r.content.length <= 24_000)
})

test('agentTemperature agent mode is 0', () => {
  assert.equal(agentTemperature('agent', undefined), 0)
  assert.equal(agentTemperature('ask', undefined), 0.3)
})

test('textFallbackResponseFormat default json_object', () => {
  assert.deepEqual(textFallbackResponseFormat(true), { type: 'json_object' })
})

test('stringifyToolResult is JSON', () => {
  const s = stringifyToolResult({ ok: true, n: 1 })
  assert.deepEqual(JSON.parse(s), { ok: true, n: 1 })
})
