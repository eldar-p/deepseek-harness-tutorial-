import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DEFAULT_CONTEXT_WINDOW,
  LOW_RAM_CTX_CAP,
  adaptiveContextCap,
  resolveContextWindow,
} from '../src/context-policy.js'

test('resolveContextWindow defaults without explicit ctx', () => {
  const prev = process.env.GIM_CTX
  delete process.env.GIM_CTX
  const n = resolveContextWindow({}, {})
  assert.ok(Number.isFinite(n) && n > 0)
  if (prev === undefined) delete process.env.GIM_CTX
  else process.env.GIM_CTX = prev
})

test('adaptiveContextCap lowers on low RAM', () => {
  assert.equal(adaptiveContextCap(512_000, { ramGb: 32, explicitCtx: false }), LOW_RAM_CTX_CAP)
  assert.equal(adaptiveContextCap(512_000, { ramGb: 128, explicitCtx: false }), 512_000)
})

test('adaptiveContextCap skips when explicit ctx', () => {
  assert.equal(adaptiveContextCap(512_000, { ramGb: 32, explicitCtx: true }), 512_000)
})

test('resolveContextWindow flag override', () => {
  assert.equal(resolveContextWindow({}, { ctx: '64000' }), 64000)
})

test('resolveContextWindow cfg fallback', () => {
  assert.equal(resolveContextWindow({ contextWindow: 32000 }, {}), 32000)
})
